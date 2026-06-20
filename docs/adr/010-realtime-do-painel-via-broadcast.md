# ADR-010: Realtime do painel via Broadcast (ping) + refetch, não postgres_changes

## Contexto
O painel e o modo TV precisam refletir mudanças em < ~2s (RNF-PERF-01, ADR-002), via Supabase
Realtime (ADR-004). A forma "natural" seria `postgres_changes` (o cliente assina as mudanças da
tabela `os`). Mas a nossa **multi-tenancy é por GUC** — `app.current_tenant` setado por transação no
`withTenant` (ADR-001/005) — e **não por claims no JWT**. O `postgres_changes` com RLS avalia as
políticas no contexto do JWT do assinante (papel `authenticated`), onde o nosso GUC é nulo: as
políticas `tenant_id = current_setting('app.current_tenant')` não casariam, e abrir o filtro
exporia linhas de outros tenants no payload. Reescrever a RLS para claims de JWT seria um redesenho
grande do modelo de isolamento — fora de escopo e indesejado.

## Decisão
Usar **Supabase Realtime Broadcast** como sinal, não como dado:
- Quando uma OS muda (abrir, transição/bump/recall, travar/destravar, override), o **servidor**
  publica um **ping** no tópico `painel:{tenantId}` — via o endpoint HTTP de broadcast do Realtime,
  autenticado com a `service_role` key. Payload vazio: é só "algo mudou aqui no seu tenant".
- O **cliente** (painel e modo TV) assina `painel:{tenantId}` pelo client do browser e, a cada ping,
  faz `router.refresh()` — que re-renderiza o server component, e a leitura **passa pela RLS** do
  `withTenant`, escopada ao tenant correto.

Ou seja: **o sinal viaja pelo canal; os dados continuam atrás da RLS** no refetch.

**Segurança**: o tópico carrega o `tenantId` (UUID). Mesmo que alguém assine o tópico de outro
tenant, só recebe um ping vazio — nenhum dado vaza, e o refetch dele continua escopado ao tenant
*dele*. Endurecer para canal privado com autorização (RLS em `realtime.messages`) fica como
follow-up; não é bloqueante porque o ping não é sensível.

**Resiliência** (RNF-DISP-01): o broadcast é *best-effort* — se o envio falhar, a mutação ainda
conclui (o painel atualiza ao navegar). O cliente mostra "ao vivo"/"reconectando" conforme o estado
do canal e mantém o último estado na tela (não trava).

## Alternativas consideradas
- **`postgres_changes` com RLS por JWT**: exigiria mover o tenant para o JWT e reescrever toda a RLS.
  Redesenho do ADR-001/005. Descartado.
- **`postgres_changes` sem RLS, filtrando no cliente**: o payload traria linhas de todos os tenants
  ao canal — vazamento. Descartado.
- **Polling** (refresh por intervalo): já descartado no ADR-002 (latência + carga com muitas TVs).
- **Broadcast a partir de trigger no banco** (`realtime.broadcast_changes`): elegante, mas a
  autorização de quem escuta cai no mesmo problema de JWT × GUC. O envio pelo servidor (que já
  conhece o tenant da sessão) é mais simples e direto.

## Consequência
Um helper de infra (`notificarPainel(tenantId)`) publica o ping nas mutações de OS (na composição,
após o sucesso). Um componente cliente (`RealtimePainel`) assina o tópico do tenant e dá
`router.refresh()` no ping, com indicador de "ao vivo/reconectando". O isolamento multi-tenant
permanece **inteiramente** no caminho da RLS — o Realtime nunca carrega dado de OS. Quando o número
sequencial de OS e outras telas ao vivo entrarem, reusam o mesmo tópico por tenant.
