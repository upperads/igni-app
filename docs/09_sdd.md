# SDD — Igni (arquitetura técnica, M5→M8)

> Fase 4b da cadeia. Desenho técnico SEM AMBIGUIDADE a partir do PRD ([07](07_prd.md)) validado pela
> pesquisa ([08](08_pesquisa_mercado.md)). **Âncora: o código real é a fonte da verdade** — este SDD
> descreve a arquitetura em produção e estende só onde o PRD pede. Honra CLAUDE.md (Drizzle-only,
> sem SQL manual em prod, RLS sempre, deploy Railway CLI, sem Playwright).
> Escala atual: dezenas de oficinas, ~2–24 motores/dia cada ([08 §9.4](08_pesquisa_mercado.md)) =
> **baixo volume**. Toda decisão abaixo recusa over-engineering para escala que não existe.

## 0. Princípio que governa o SDD
A arquitetura atual (hexagonal: domain puro → application → infra → app; multi-tenant por GUC+RLS)
**já serve 10x o volume atual** sem mudança estrutural. O trabalho de M5→M8 é **preencher**, não
redesenhar. A única decisão arquitetural genuinamente nova e arriscada é o **portal público (M6)** —
o resto é UI + wiring sobre fundação testada. ADRs novos só onde há decisão real (§9).

---

## 1. Modelo de dados (ERD real + deltas)

### 1.1 Tabelas existentes (não mexer, exceto onde marcado)
`tenant` (raiz, sem tenant_id — É o tenant) · `usuario` · `estacao` · `tentativa_login` ·
`cliente` · `equipamento` · `entrada` · `os` · `evento` · `ajuste_prioridade` · `orcamento` ·
`orcamento_item`. Todas com `tenant_id` + RLS por GUC, exceto `tenant` (self-isolation).
Evidência: [schema/](../src/infra/db/schema), [0001_rls](../src/infra/db/migrations/0001_rls_tenant_isolation.sql).

### 1.2 Delta 1 — Número sequencial de OS por tenant (F4)
**Problema:** o card usa `refCurta(id)` (hash) — o chão não decora "a1b2c3d4" ([07 F4](07_prd.md)).
**Decisão:** coluna `numero integer` em `os`, **sequencial por tenant** (não global — "OS-41" é da oficina).

**Como gerar sem race (idempotência):** NÃO usar `SEQUENCE` do Postgres (é global, não por-tenant) nem
`MAX(numero)+1` em leitura solta (race sob concorrência). Usar uma **tabela de contador por tenant**
com incremento atômico dentro da própria transação de `abrirOS` (que já é `withTenant`):

```
tenant_contador_os { tenant_id uuid PK→tenant, proximo integer NOT NULL DEFAULT 1 }
-- em abrirOS, dentro do tx:
UPDATE tenant_contador_os SET proximo = proximo + 1
  WHERE tenant_id = $t RETURNING proximo - 1 AS numero;   -- cria a linha no 1º uso (upsert)
```
O `UPDATE ... RETURNING` serializa por linha (lock de linha) → sem race, mesmo com 2 recepções
abrindo OS ao mesmo tempo. Volume é baixo; custo desprezível. Coluna `os.numero NOT NULL` +
`UNIQUE(tenant_id, numero)`. Migração: backfill das OS existentes por `created_at` antes do `NOT NULL`.
**Trade-off:** uma tabela a mais vs. correção garantida. A simplicidade do `MAX+1` quebra sob corrida —
recusada. → **ADR-011**.

### 1.3 Delta 2 — Histórico de responsabilização (F-Resp): DECISÃO = ZERO tabelas novas
**Pendência do PRD resolvida aqui.** A pergunta: dá pra fazer "nos últimos 30 dias, 60% do atraso foi
peça do cliente" sem nova tabela? **Sim.** Os dados já existem:
- `evento` (de/para/quando) = a linha do tempo completa da OS (RF-11, [evento.ts](../src/infra/db/schema/evento.ts)).
- `os.travado` + `travamento_responsabilidade` (empresa/cliente) + `estado` = a culpa atual.
- `culpaDoAtraso(travado, responsabilidade, estado)` no domínio ([painel.ts](../src/domain/os/painel.ts))
  já deriva nossa/cliente/peça.

O histórico é uma **agregação de leitura** sobre `evento`+`os`, não um novo registro. Modelagem:
o "tempo parado por culpa de X" sai do intervalo entre eventos de transição (entrou/saiu de um estado
travado). **Decisão:** F-Resp histórico = **view/consulta de composição** (`historicoResponsabilidade(sessao, janelaDias)`),
domínio puro `resumoCulpa(eventos, agora)` que recebe a timeline e devolve % por culpa. **Sem schema novo.**
**Trade-off:** computar on-read a cada abertura do relatório vs. materializar. Volume baixo → on-read é
grátis e sempre correto; materializar seria over-engineering. → registra como **nota no ADR-012** (não
precisa de tabela). **Viabilidade: barata → entra como candidata RICE real**, não pós-MVP.

### 1.4 O que NÃO entra no schema (régua NÃO-É)
`laudo`/`peca_compra` do ERD antigo ([03](03_architecture.md)) ficam fora do MVP (diagnóstico/peça
estruturados são escala). Nada de fiscal/financeiro (integração futura).

---

## 2. F1 — Orçamento UI (M5): só UI + wiring (domínio PRONTO)
**Nada de novo no backend.** Os casos de uso existem e estão testados:
`montarOrcamento`/`enviarOrcamento`/`aprovarOrcamento`/`recusarOrcamento`/`reabrirOrcamento`/
`aprovarCq`/`resolverContextoGate` ([orcamento.ts](../src/application/orcamento.ts)), domínio
([orcamento/orcamento.ts](../src/domain/orcamento/orcamento.ts)), testes
([orcamento.test.ts](../src/application/__tests__/orcamento.test.ts)).

**A fazer (UI):**
- Composição: wrappers em [composition/os.ts](../src/infra/composition/os.ts) (`montarOrcamentoNoTenant`,
  etc.) que injetam `database` + chamam `notificarPainel(tenantId)` no fim (igual aos outros mutadores).
- Server actions em `src/app/os/[id]/` + seção "Orçamento" no detalhe (client component com `useTransition`).
- Dinheiro: UI digita reais → action converte para **centavos inteiros** (regra já no schema/domínio).
- RBAC: `producao` em modo leitura (usar `pode()` de [rbac.ts](../src/domain/auth/rbac.ts)).
- 6 estados de UI (sucesso/vazio/loading/erro/permissão/overflow) — F1 do PRD.

**Gate real (já funciona):** `resolverContextoGate` lê `orcamento.status==='aprovado'` + `os.cqAprovado`.
**Wiring que falta:** `transicionarNoTenant` deve chamar `resolverContextoGate` em vez do contexto
cravado `{orcamentoAprovado:false}`. É troca de 1 linha na composição. (§3)

---

## 3. Gates reais — onde ligar
Hoje `acaoTransicionar` passa contexto fixo. **Decisão:** mover a resolução do contexto para a
**composição** (`transicionarNoTenant` chama `resolverContextoGate(database, sessao, osId)` e passa o
resultado a `executarTransicao`). A action deixa de conhecer gate. `executarTransicao` continua puro-de-
contexto (recebe `ContextoTransicao`) — preserva os testes unitários existentes que injetam contexto.
**Trade-off:** uma leitura a mais por transição (orçamento+os) vs. gate honesto. Leitura trivial, dentro
do mesmo `withTenant`. Sem ADR (é wiring de decisão já tomada no ADR-008).

---

## 4. F2 — Portal do cliente público (M6): a decisão arquitetural central → ADR-012

### 4.1 O problema, exato
Rota **pública, sem login**, que abre **só uma OS** via token — **sem furar a RLS por GUC**. A RLS é
fail-closed: `current_setting('app.current_tenant', true)` NULL → zero linhas
([0001_rls](../src/infra/db/migrations/0001_rls_tenant_isolation.sql)). O portal não tem sessão Supabase
nem tenant no contexto. Como ler a OS do cliente sem virar um buraco no isolamento?

### 4.2 Decisão: resolução de tenant em DUAS ETAPAS (privilegiada mínima → withTenant)
```
1. Request chega em /portal/[token] (Server Component, sem auth).
2. tokenHash = sha256(token).
3. LEITURA PRIVILEGIADA MÍNIMA (db, bypass RLS) — UMA query, só o indispensável:
     SELECT orcamento.os_id, orcamento.tenant_id, orcamento.token_expira_em, orcamento.status
       FROM orcamento WHERE token_hash = $hash LIMIT 1;
   - Não achou? → 404 "link inválido" (sem vazar nada).
   - Expirado (token_expira_em < now)? → página "link expirou".
4. Com o tenant_id resolvido, TODA leitura subsequente do portal usa withTenant(tenant_id, ...)
   escopada — a RLS volta a valer normalmente, e a query é filtrada por os_id.
5. O Server Component renderiza SÓ aquela OS (estado/stepper/itens/responsabilização) em tema claro.
```
**Por que é seguro:** a query privilegiada é **uma só, indexada por `token_hash` (UNIQUE), retorna no
máximo 1 linha**, e o `token_hash` é imprevisível (32 bytes random, base64url, hash sha256). Conhecer o
hash exige conhecer o token — que só foi entregue ao cliente daquela OS. O `tenant_id` resolvido **vem do
próprio registro do token**, não de input do usuário. A partir do passo 4, o isolamento é o mesmo de todo
o app. **Blast radius:** comprometer um token expõe **uma OS**, nunca o tenant inteiro nem outros tenants.

### 4.3 O que o token NÃO permite (escopo mínimo)
- Não lista outras OS (nem do mesmo cliente/tenant) — toda query do portal filtra por `os_id` do token.
- Não escreve nada exceto **aprovar/recusar o próprio orçamento** (passo 6 abaixo).
- Não expõe dados do tenant (usuários, outras OS, financeiro).
- Não vira sessão; cada request revalida o token do zero (stateless).
- Expira (`token_expira_em`, default 7 dias, configurável — §6).

### 4.4 Aprovar/recusar pelo portal (escrita pública controlada)
Caso de uso novo, **espelho do interno mas resolvido por token** (não por sessão):
```
aprovarPorToken(database, token): resolve hash→{tenantId, osId, status}; valida não-expirado +
  podeDecidir(status); então withTenant(tenantId): aprovarOrcamento-core(osId).  (idem recusar)
```
Reusa o núcleo já testado (`aprovarOrcamento`/`recusarOrcamento`), trocando só a origem da autorização
(token em vez de sessão+RBAC). **Idempotência:** se o status já não é `enviado`, a ação é no-op com
mensagem clara ("este orçamento já foi decidido") — repetir o POST (erro de rede) não duplica efeito.
**Anti-abuso (baixo volume):** rate-limit leve por token/IP é suficiente; sem CAPTCHA no MVP (1 token = 1 OS).
**CDC ([07 F2](07_prd.md)):** os textos comunicam estado/dependência, nunca isenção de culpa.

### 4.5 Realtime no portal (reuso ADR-010)
O portal pode assinar o broadcast por tenant para refletir mudança de estágio ao vivo. **Decisão:** reusar
o tópico `painel:{tenantId}` ([notificar.ts](../src/infra/realtime/notificar.ts)) — o portal é read-only e
o ping não carrega dado (refetch via withTenant escopado por os_id). **Trade-off:** o portal recebe pings de
mudanças de OUTRAS OS do mesmo tenant (refetch desnecessário). Volume baixo → custo irrelevante; criar
tópico por-OS seria over-engineering. Aceito. (Se incomodar em 10x, tópico `os:{osId}` é a evolução —
nota no ADR-012, não agora.)

### 4.6 Tema claro (osso)
Layout próprio `src/app/portal/layout.tsx` sem `AppShell` (que é o board escuro), usando `--osso-50` e a
paleta clara. É o único lugar com `color-scheme: light`. Componentes do portal são novos (stepper,
cartão de responsabilização) — não reusam os do board escuro.

---

## 5. Realtime (estado atual, sem mudança)
Broadcast por tenant via endpoint HTTP do Supabase com service key, best-effort, cliente assina e
`router.refresh()` (ADR-010, [notificar.ts](../src/infra/realtime/notificar.ts),
[realtime-painel.tsx](../src/app/_components/realtime-painel.tsx)). M6 só **reusa**. Hardening do canal
privado (RLS em `realtime.messages`) segue follow-up — não bloqueia (ping não-sensível).

---

## 6. Fixo vs configurável (onde mora cada número)
| Item | Hoje | Decisão |
|---|---|---|
| Pesos da razão crítica / SLAs | `CONFIG_TRIAGEM_PADRAO` em [triagem.ts](../src/domain/os/triagem.ts), injetável | Mantém em código (default) + injeção; override por tenant/template = **M8**, não agora |
| Validade do token do portal | `VALIDADE_TOKEN_DIAS=7` em [orcamento.ts](../src/application/orcamento.ts) | Constante por ora; vira config por tenant no M8 |
| Janela do histórico de culpa | — | Parâmetro do caso de uso (default 30 dias), não schema |
| Paginação técnica | 20/página (fixo, CLAUDE.md) | Mantém |
Datas/fusos: UTC/ISO 8601 sempre (já é a regra; `diasRestantesAte` opera em UTC).

---

## 7. Migrations, testes, CI
**Migrations (Drizzle-only):** `tenant_contador_os` + `os.numero` (estrutural `db:generate`) +
RLS custom (`rls_contador_os`) no padrão 0007/0009/0011 (GRANT app_user + ENABLE sem FORCE + policy por
tenant). Backfill de `numero` antes do `NOT NULL`. **Nunca SQL manual em prod** — `pnpm db:migrate` contra
o cloud no deploy (como M2–M5).
**Testes (Definition of Done):**
- Unidade (domínio puro): `resumoCulpa` (histórico), e os existentes.
- Integração + RLS: casos de uso novos (numero sequencial sem race — teste com 2 inserts; aprovarPorToken).
- **Isolamento multi-tenant obrigatório:** teste que o token de um tenant **não** abre OS de outro, e que
  a leitura privilegiada do portal só devolve a OS do token. **Teste de vazamento é gate de CI.**
- Token: expirado → negado; hash guardado, nunca o cru (já testado em orcamento.test.ts).
**CI:** mesmo pipeline (build→lint→typecheck→test→checagem de migrations). Sem Playwright; verificação por
testes + curl (smoke). O teste de isolamento do portal é o novo item crítico.

---

## 8. Sequência de implementação (sem ambiguidade, ordem RICE)
1. **F1 UI orçamento** + wiring do gate real (`transicionarNoTenant`→`resolverContextoGate`) + composição/actions. (domínio pronto)
2. **F4 número de OS** (ADR-011): contador + migration + backfill + exibir no card/detalhe.
3. **F2 portal** (ADR-012): leitura 2-etapas, rota `/portal/[token]`, tema claro, aprovar/recusar por token, realtime reuso, teste de isolamento.
4. **F-Resp histórico** (sem schema): `resumoCulpa` + composição + tela de relatório.
5. **F3 polimento** (loading/erro/aria-live/contraste aco-300/nav/not-found) + **F-Simpl** (métrica de bump no chão).
6. **Escala (pós-validação):** M7 WhatsApp, M8 templates + config por tenant.

---

## 9. ADRs novos a registrar
- **ADR-011 — Número sequencial de OS por tenant via tabela-contador** (não SEQUENCE global, não MAX+1):
  trade-off race-safety vs. uma tabela; lock de linha no `UPDATE...RETURNING`.
- **ADR-012 — Portal público do cliente: acesso por token com resolução de tenant em duas etapas**
  (leitura privilegiada mínima por `token_hash` → `withTenant` escopado). Modelo de segurança: escopo
  mínimo (1 OS), expiração, hash-only, stateless, blast radius = 1 OS. Inclui nota: histórico de
  responsabilização = agregação on-read sobre `evento` (zero tabelas); realtime reusa tópico por tenant.

## 10. O que este SDD recusa (anti-over-engineering)
- **Sem** fila/event-bus/microserviço — volume é dezenas de OS/dia; Server Actions + Postgres bastam.
- **Sem** materializar histórico de culpa — on-read é grátis nesse volume.
- **Sem** reescrever RLS para JWT por causa do portal — a resolução 2-etapas resolve mantendo o modelo GUC.
- **Sem** tópico de realtime por-OS — por-tenant basta até 10x.
- **Sem** CAPTCHA/auth pesada no portal — 1 token = 1 OS + expiração + rate-limit leve é proporcional ao risco.
