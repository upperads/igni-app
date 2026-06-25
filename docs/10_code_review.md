# Code Review — Igni (M1–M4 + domínio M5)

> Fase de review da cadeia. Régua: SDD ([09](09_sdd.md)), PRD ([07](07_prd.md)), ADRs 001–012, CLAUDE.md.
> Review, não reescrita. Evidência arquivo:linha. 🔴 bloqueia · 🟡 corrigir · 🟢 sugestão.

## Veredicto geral
**Saúde do código: BOA.** A fundação multi-tenant (GUC+RLS, `withTenant`), o domínio puro e a cobertura
de testes (88+) são sólidos e raros nesse estágio. O isolamento está **bem-feito**: toda query de leitura/
escrita de dados de tenant passa por `withTenant` ([composition/os.ts](../src/infra/composition/os.ts)),
e o eslint boundary guard impede `src/app` de importar o `db` privilegiado. **Não achei furo de
isolamento.** Os bloqueantes abaixo são de **consistência com o SDD** e de **RBAC no boundary** — não de
arquitetura.

## Bloqueante ANTES de M5 UI / M6 portal
Dois 🔴 e o RBAC. O resto pode ir em paralelo.

---

## 🔴 Bloqueia

**🔴 1 · [app/os/actions.ts:99-130 + composition/os.ts:47-58] — Gate ainda CRAVADO; `resolverContextoGate` nunca é chamado.**
`acaoTransicionar` monta `contexto: { orcamentoAprovado: false, cqAprovado: false }` e
`transicionarNoTenant` repassa esse `input` direto a `executarTransicao`. O caso de uso
`resolverContextoGate` ([orcamento.ts](../src/application/orcamento.ts)) **existe e está testado, mas não
está ligado**. Efeito hoje em prod: **execução e "pronta" ficam barradas para sempre** (orçamento nunca
"aprova" porque o contexto é fixo) — o ciclo da OS não fecha. O SDD §3 manda mover a resolução para a
composição.
  **Fix:** `transicionarNoTenant` deixa de receber `contexto`; chama
  `const contexto = await resolverContextoGate(database, sessao, input.osId)` e passa a `executarTransicao`.
  `acaoTransicionar` para de montar contexto. (1 linha de wiring + ajuste de tipo do input.) **É o item 1 do M5.**

**🔴 2 · [app/os/actions.ts — todas as actions] — RBAC não é aplicado no boundary.**
`pode()/assertPode()` ([rbac.ts](../src/domain/auth/rbac.ts)) existem e o `sessaoAtual()` já traz `papel`
([sessao.ts](../src/infra/auth/sessao.ts)), mas **nenhuma server action chama `assertPode`**. A regra de
ouro "produção não edita orçamento" (RN, PRD F1) hoje **só vale no domínio, que ninguém invoca para
autorizar**. Quando a UI de orçamento existir, um usuário `producao` conseguiria aprovar/ajustar via
action se a checagem não estiver no boundary. É o ponto onde autorização **tem** que estar.
  **Fix:** em cada action mutadora, após `sessaoAtual()`, `assertPode(sessao.papel, '<acao>')` e tratar
  `AutorizacaoNegadaError` como retorno de erro. Criar o mapa de ações→papéis se ainda não cobrir
  orçamento/triagem. **Fazer junto do M5 UI** (antes de expor edição de orçamento).

---

## 🟡 Deveria corrigir

**🟡 3 · [composition/os.ts:42-43, 54-55, 66-67, 77, 83, 88] — `recalcular` + `notificar` fora de transação, sem idempotência de falha parcial.**
Cada mutador faz: caso de uso (tx A) → `recalcularPrioridade` (tx B) → `notificarPainel` (HTTP). Se a tx B
falhar, a OS muda de estado mas a prioridade fica stale (até o próximo recalc). Baixo risco no volume
atual, mas é uma janela de inconsistência. `notificarPainel` já é best-effort (ok).
  **Fix (barato):** aceitável por ora — documentar que a prioridade é "eventualmente consistente". Se
  quiser fechar: passar o `recalcular` para dentro do mesmo `tx` do caso de uso (o SDD já prevê
  `aplicarPrioridade(tx, …)` reutilizável). Não bloqueia.

**🟡 4 · [app/os/actions.ts:99-102] — comentário desatualizado afirma "M5 liga o contexto real" como se fosse futuro.**
O comentário descreve o gate cravado como estado correto. Depois do fix #1 vira mentira no código.
  **Fix:** atualizar o comentário ao ligar o gate (parte do #1).

**🟡 5 · [composition/os.ts:181-183, 252] — `refCurta(id)` exibe hash do UUID como código da OS.**
Dívida já reconhecida (SDD §1.2, ADR-011). É 🟡 porque afeta usabilidade no chão (PRD F4), não corretude.
  **Fix:** implementar o número sequencial por tenant (ADR-011) e trocar `refCurta` por `os.numero` no que é
  voltado ao humano. Próximo passo após o gate.

**🟡 6 · [LGPD — detalheOs e telas] — placa/chassi trafegam para a UI sem máscara; sem evidência de mascaramento em logs.**
[composition/os.ts:308-310] seleciona `placa`/`chassi` (dados pessoais, RNF-SEC/LGPD do SRS). Para a tela
interna do operador é need-to-know (ok), mas **o portal público (M6) não pode expor chassi**, e não há
helper de máscara para logs.
  **Fix:** criar helper de máscara (ex.: `mascararPlaca`/`mascararChassi`) e aplicar no **portal** e em
  qualquer log. Tratar no M6 + `/auditoria-seguranca`. Registrar como requisito do portal.

---

## 🟢 Sugestões

**🟢 7 · [domain/os/triagem.ts — `urgenciaBase`] — `Math.max(diasRestantes, 0.5)` é um “número mágico”.**
O piso 0.5 evita divisão por zero/explosão, mas não está em `ConfigTriagem` (que o resto respeita).
  **Fix:** mover o piso para `CONFIG_TRIAGEM_PADRAO` por coerência (tudo configurável num lugar só). Trivial.

**🟢 8 · [app/painel/tv/page.tsx + realtime-painel.tsx] — dívidas de A11y/realtime da auditoria V1.**
Sem `aria-live` no board que muda sozinho (P0-2 da [auditoria](UX_AUDIT_DOSSIE_V1.md)); contraste `aco-400`
a validar (P1-1); `middleware`→`proxy` (Next 16, só aviso). Não-bloqueantes, já mapeados no PRD F3.
  **Fix:** fatia de polimento F3 (aria-live, `aco-300`, loading/error states).

**🟢 9 · [composition/os.ts:202] — `listarPainel` usa `new Date()` como default → server component não-determinístico/cacheável.**
Funciona, mas dificulta teste e cache. Menor.
  **Fix:** já aceita `agora` injetável; manter e considerar passar explicitamente onde testar.

**🟢 10 · [domain/orcamento/orcamento.ts — `totalItem`] — arredondamento `Math.round` por item (não no total).**
Correto e previsível (arredonda cada item ao centavo antes de somar), mas documentar a escolha evita
divergência de centavo com quem esperar arredondamento no total. Já testado.
  **Fix:** comentar a decisão de arredondar por item. Nenhuma mudança de código.

---

## Modelagem de dados/domínio vs SDD (o "/modelo")
- **Aderente.** As 11 tabelas batem com o SDD §1.1; `orcamento`/`orcamento_item` corretos (centavos inteiros,
  `UNIQUE(os_id)`, token hash+expiração). Falta só o delta do ADR-011 (`tenant_contador_os` + `os.numero`).
- **Histórico de responsabilização (F-Resp):** confirmado viável on-read sobre `evento` — a timeline tem
  de/para/quando ([evento.ts](../src/infra/db/schema/evento.ts)); **zero tabelas novas** (SDD §1.3). ✅
- **Domínio puro:** `estado.ts`/`triagem.ts`/`painel.ts`/`orcamento.ts` sem dependência de infra. ✅ SOLID ok.

## Resumo acionável (ordem)
1. **#1 gate real** (desbloqueia o ciclo — fazer no início do M5 UI).
2. **#2 RBAC no boundary** (antes de expor edição de orçamento).
3. **#6 máscara LGPD** (requisito do M6 portal).
4. **#5 número de OS** (ADR-011, logo após o gate).
5. 🟡#3 consistência recalc + 🟢 polimento/A11y (F3) em paralelo.
