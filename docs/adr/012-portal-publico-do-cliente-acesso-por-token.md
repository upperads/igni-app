# ADR-012: Portal público do cliente — acesso por token com resolução de tenant em duas etapas

## Contexto
O M6 (PRD F2, [07](../07_prd.md)) é a primeira superfície **pública, sem login**: o cliente abre um link
e vê **só a sua OS** (estágio, responsabilização, orçamento) e aprova/recusa. É o pilar do diferencial
validado pela pesquisa ([08 §9.2](../08_pesquisa_mercado.md): ninguém responsabiliza o atraso).

O desafio é de isolamento. A multi-tenancy do Igni é por **GUC + RLS**, fail-closed: as políticas comparam
`tenant_id = current_setting('app.current_tenant', true)::uuid`, e sem o GUC setado o `current_setting`
devolve NULL → nenhuma linha ([0001_rls](../../src/infra/db/migrations/0001_rls_tenant_isolation.sql)).
O portal não tem sessão Supabase nem tenant no contexto. Como ler a OS do cliente **sem furar a RLS** e
**sem reescrever o modelo de isolamento** (que é decisão registrada — ADR-001/005/010)?

## Decisão
**Resolução de tenant em duas etapas:**

1. **Leitura privilegiada mínima** (na conexão `db`, que bypassa RLS — a mesma usada no onboarding):
   uma única query, indexada por `token_hash` (UNIQUE), retornando só o indispensável —
   `orcamento.os_id`, `orcamento.tenant_id`, `token_expira_em`, `status`. Não achou → 404 genérico
   (sem vazar). Expirado → página "link expirou".
2. **Tudo o mais via `withTenant(tenant_id, …)`** com o tenant **resolvido do próprio registro do token**
   (não de input do usuário). A RLS volta a valer integralmente; as queries do portal filtram por `os_id`.

O token: 32 bytes aleatórios (`randomBytes(32).toString("base64url")`), e guardamos **só o hash
sha256** (`token_hash` em [orcamento](../../src/infra/db/schema/orcamento.ts)) — nunca o token cru,
como na recuperação de senha. Expiração em `token_expira_em` (default 7 dias, configurável no M8).

**Escopo mínimo — o que o token NÃO permite:**
- Não lista outras OS (nem do mesmo cliente/tenant): toda query filtra por `os_id` do token.
- Não escreve nada exceto **aprovar/recusar o próprio orçamento** (`aprovarPorToken`/`recusarPorToken`,
  que reusam o núcleo testado trocando a origem da autorização de sessão+RBAC para token).
- Não expõe usuários, outras OS, financeiro do tenant.
- Não cria sessão: cada request revalida o token do zero (stateless).

**Idempotência:** se o status do orçamento já não é `enviado`, aprovar/recusar é no-op com mensagem
clara — repetir o POST (erro de rede do cliente) não duplica efeito.

**Realtime:** o portal reusa o broadcast por tenant (ADR-010) para refletir mudança de estágio; o ping
não carrega dado (refetch escopado por `os_id`). Recebe pings de outras OS do tenant (refetch à toa) —
aceitável no volume atual; tópico por-OS fica como evolução futura, não agora.

**CDC / LGPD:** os textos de responsabilização comunicam **estado e dependência**, nunca isenção de
culpa ([07 F2](../07_prd.md), [08 §4.1](../08_pesquisa_mercado.md)). Placa/chassi são dados pessoais —
exibir o mínimo no portal. A revisar no `/auditoria-seguranca`.

**Histórico de responsabilização (F-Resp):** decidido no SDD — é **agregação on-read sobre `evento`**
(a linha do tempo já existe), **zero tabelas novas**. Não impacta este ADR além de ser outra leitura
escopada por `withTenant`.

## Alternativas consideradas
- **Reescrever a RLS para usar claims de JWT** (e emitir um JWT de escopo de OS para o portal): redesenho
  do modelo de isolamento (ADR-001/005), muito maior blast radius de mudança. Descartado — a resolução
  2-etapas resolve mantendo o GUC.
- **Política RLS específica para "anônimo via token"** (ex.: um GUC `app.current_os`): adiciona uma
  segunda dimensão de RLS e complexidade de política para um caso de leitura única; a leitura privilegiada
  mínima + `withTenant` é mais simples e tem o mesmo isolamento. Descartado.
- **Expor a OS por um endpoint sem RLS filtrando no app**: jogaria o isolamento para o código de
  aplicação em vez do banco — contra o princípio "a RLS é a rede de segurança". Descartado.

## Consequência
O portal público abre exatamente **uma OS** por token, com **blast radius = 1 OS** se um token vazar
(nunca o tenant inteiro, nunca outro tenant). O modelo GUC/RLS permanece intacto. Surge uma rota
`/portal/[token]` (Server Component, tema claro `--osso-50`, sem `AppShell`), casos de uso
`aprovarPorToken`/`recusarPorToken`, e um **teste de isolamento obrigatório no CI**: o token de um tenant
não abre OS de outro, e a leitura do portal só devolve a OS do token. A geração do token e o hash já
existem (`enviarOrcamento`); falta a superfície de consumo.
