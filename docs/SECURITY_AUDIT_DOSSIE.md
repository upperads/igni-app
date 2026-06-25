# Dossiê de Segurança — Igni (igni-app)

> Auditoria **static-only** (sem Playwright — restrição do projeto). Threat modeling de SaaS B2B
> multi-tenant BR. Evidência: código + `pnpm audit` + grep. Régua: SRS RNF-SEC ([02](02_definition.md)),
> SDD ([09](09_sdd.md)), review ([10](10_code_review.md)), ADRs 001–012. LGPD (não GDPR).

## Executive summary
**Postura de segurança: BOA para o estágio (nota ~82/100).** A fundação está acima da média: isolamento
multi-tenant por RLS fail-closed bem-feito, segredos fora do código (`.env` gitignored, service-role
**server-only**, não vaza para o client), zero `dangerouslySetInnerHTML`/`eval` (React escapa os campos
livres → sem XSS stored óbvio), zero `console.log` (sem PII em log hoje). **Nenhum achado Crítico no
código atual.** Os pontos quentes são **2 itens bloqueantes antes do M6 portal** (RBAC no boundary + token
do portal endurecido) e **LGPD de placa/chassi** (mascaramento ainda inexistente). Não há cliente real em
prod ainda (conta de teste), então o risco material **hoje** é baixo — mas precisa fechar antes de piloto.

## Threat model (quem ataca × probabilidade × impacto)
| Ator | Vetor provável | Prob. | Impacto |
|---|---|---|---|
| **Curioso/cliente final** | adivinhar/enumerar token do portal; ver OS de outro | Média (pós-M6) | Alto (PII de outro cliente) |
| **Insider (papel `producao`)** | editar/aprovar orçamento sem permissão (privilege escalation) | Média | Alto (fura gate/integridade financeira) |
| **Concorrente** | scraping de OS via IDOR/tenant-bleed | Baixa | Crítico (vazamento multi-tenant) |
| **Script kiddie** | brute-force de login; CVE de dependência | Média | Médio (lockout já mitiga) |
| **Estado/APT** | fora do modelo de ameaça deste estágio | — | — |

---

## Achados por severidade

### 🔴 CRÍTICO
Nenhum no código atual. (O isolamento multi-tenant, que seria o crítico clássico, está correto — ver C-1.)

### 🟠 ALTO — bloqueiam o M6 portal / piloto

**A-1 · RBAC não aplicado no boundary (privilege escalation).** `assertPode` existe ([rbac.ts](../src/domain/auth/rbac.ts)) e `sessaoAtual()` traz `papel` ([sessao.ts](../src/infra/auth/sessao.ts)), mas **nenhuma server action** ([app/os/actions.ts](../src/app/os/actions.ts)) chama autorização. Hoje qualquer papel autenticado (inclusive `producao`) pode disparar transição/travamento/override — e, quando a UI de orçamento existir, **aprovar orçamento**.
- **Vetor:** usuário `producao` chama a server action diretamente (são endpoints) → fura "produção não edita orçamento" (RN) e os gates.
- **CVSS ~7.1** (AV:N/PR:L/UI:N — exige conta, mas escala privilégio).
- **Mitigação:** `assertPode(sessao.papel, '<acao>')` em toda action mutadora; tratar `AutorizacaoNegadaError`. **Bloqueante antes do M5 UI** (review #2). Esforço: baixo.

**A-2 · Token do portal precisa de endurecimento ANTES de ir ao ar (M6/ADR-012).** O desenho (32B random, sha256, exp 7d, resolução 2-etapas) é **sólido na confidencialidade** (blast radius = 1 OS; tenant vem do registro do token, não de input). Mas faltam controles no desenho:
- **Sem rate-limit** → brute-force/enumeração do token (mesmo improvável com 256 bits, é higiene) e **DoS na leitura privilegiada**.
- **Timing:** a query por `token_hash` deve ser constant-ish; o 404 já é genérico (bom) — garantir que "não-achou" e "expirado" não diferenciem por tempo/corpo de forma explorável.
- **Idempotência:** aprovar/recusar deve ser no-op se status≠enviado (já previsto) — **garantir** para evitar replay.
- **CVSS ~6.5** (potencial, pós-M6).
- **Mitigação (bloqueante p/ M6):** rate-limit por IP+token (ex.: 10/min) na rota `/portal/[token]` e nas actions de decisão; resposta uniforme para inválido/expirado; teste de isolamento (token de A não abre OS de B) como **gate de CI** (já no SDD §7).

### 🟡 MÉDIO

**M-1 · LGPD: placa/chassi sem mascaramento (telas e logs).** `detalheOs` seleciona `placa`/`chassi` ([composition/os.ts:308-310](../src/infra/composition/os.ts)) e trafega para a UI. Dados pessoais (RNF-SEC-08 do [SRS](02_definition.md)). Hoje: tela interna do operador é need-to-know (aceitável), mas **(a)** não há helper de máscara para o **portal público** (M6 **não pode** expor chassi), e **(b)** não há mascaramento padronizado se algum log surgir.
- **Mitigação:** helper `mascararPlaca`/`mascararChassi` (ex.: `ABC1•••`, chassi últimos 4); aplicar no portal e em qualquer log futuro. Definir **base legal** (execução de contrato — CDC), **retenção** e fluxo de exclusão do titular. Bloqueante para o **portal**, não para o interno.

**M-2 · CVE moderada transitiva — postcss <8.5.10 (XSS via `</style>`).** `pnpm audit`: 1 moderate, path `next>postcss`. Risco real baixo (build-time, não runtime de input do usuário).
- **Mitigação:** `pnpm update` quando o Next puxar postcss ≥8.5.10, ou override. Não-bloqueante.

**M-3 · Recuperação de senha — follow-ups já conhecidos.** Conta com 2FA exige AAL2 para trocar senha (Supabase 401 — comportamento **correto**, [atualizar-senha/form.tsx](../src/app/atualizar-senha/form.tsx) já explica); SMTP/site_url do cloud pendente (recuperação por e-mail só funciona local hoje). Não revela existência de conta ([recuperar/form.tsx](../src/app/recuperar/form.tsx)) — **bom**.
- **Mitigação:** configurar SMTP+site_url no cloud antes do piloto; o resto está correto.

**M-4 · CDC — responsabilização não pode virar isenção de culpa.** Textos hoje ("Bola com a oficina/cliente", [travamento-selo.tsx](../src/ui/components/travamento-selo.tsx)) estão no tom certo (estado/dependência). Risco jurídico se algum texto futuro afirmar que a oficina **não** é responsável.
- **Mitigação:** regra de copy no PRD (já adicionada, [07 F2](07_prd.md)); revisar todo texto do portal antes do M6. Não é vuln técnica, é risco legal — registrar.

### 🟢 BAIXO / INFO

**B-1 · GUC re-gravável dentro de `withTenant`.** Documentado como invariante ([connection.ts](../src/infra/db/connection.ts)): nunca SQL raw dentro de `fn`. Drizzle é parametrizado → SQLi não se aplica. Mantido como invariante de review.
**B-2 · CSRF:** server actions do Next App Router têm proteção nativa (POST same-origin + Origin check). Sem endpoints REST custom expostos. OK.
**B-3 · Realtime broadcast público:** o tópico `painel:{tenantId}` é público; alguém com o tenantId (UUID) recebe pings vazios (sem dado). Aceito (ADR-010); hardening (canal privado) é follow-up.
**B-4 · Headers de segurança (CSP/HSTS):** não há `next.config` com headers explícitos — Railway/Supabase dão HTTPS, mas CSP/HSTS explícitos são higiene. Adicionar no `next.config` (info).

---

## Confidentiality / Integrity / Availability

**C-1 · Confidencialidade (isolamento) — FORTE.** `withTenant` faz `set_config('app.current_tenant')` + `SET LOCAL ROLE app_user` por tx; RLS fail-closed (GUC nulo → zero linhas, confirmado em [0001_rls](../src/infra/db/migrations/0001_rls_tenant_isolation.sql)). O `db` privilegiado é barrado em `src/app` pelo eslint boundary guard. **Não achei caminho de tenant-bleed.** O ponto a vigiar é o **único uso legítimo futuro do `db` privilegiado**: a leitura de token do portal (1 query, indexada, retorna 1 linha) — projetada com escopo mínimo.

**Integridade.** Gates (RN-01) garantem a máquina de estados; dinheiro em centavos inteiros (sem drift); auditoria de override (`ajuste_prioridade`) e timeline (`evento`). **Furo:** os gates só valem se ligados — hoje o gate real **não está conectado** (review #1) e o RBAC não está no boundary (A-1). Ligar ambos fecha a integridade.

**Disponibilidade.** Realtime best-effort (não derruba mutação). **Falta rate-limit** no que será público (A-2). Volume baixo → DDoS não é prioridade agora, mas o portal público muda isso.

---

## Compliance LGPD (5 pontos)
1. **Base legal:** execução de contrato (serviço de retífica) — documentar para placa/chassi/cliente.
2. **Minimização:** portal expõe só o necessário; **mascarar chassi** (M-1).
3. **Retenção:** definir prazo de guarda da OS/dados do cliente pós-entrega.
4. **Direito do titular:** fluxo de acesso/exclusão (ainda não existe) — backlog pós-MVP.
5. **DPO/ANPD:** nomear responsável; registro de operações. Estágio inicial — registrar a intenção.

---

## Veredicto e roadmap

**Cliente em risco material AGORA?** **Não** — não há cliente real em prod (conta de teste), service-role não vaza, isolamento correto. Mas **2 itens são bloqueantes antes de piloto/M6.**

**Sprint bloqueante (antes do M5 UI / M6 portal):**
1. **A-1** RBAC no boundary (`assertPode` nas actions).
2. **A-2** rate-limit + resposta uniforme + teste de isolamento do portal (no M6).
3. **M-1** máscara de placa/chassi (no portal).

**Sprint 30 dias:** M-2 (postcss), M-3 (SMTP cloud), B-4 (headers CSP/HSTS).
**Backlog:** LGPD direito do titular/retenção, canal privado do realtime (B-3), pentest externo.

**Pentest externo?** **Ainda não** — sem cliente real e com a postura atual, o custo não se paga. **Sim, antes de escalar** (após 2–3 pilotos), focado no portal público.

> Próximo: retomar o DEV — ligar o gate real, **A-1 (RBAC)** junto da UI de orçamento, e **A-2+M-1** no M6.
