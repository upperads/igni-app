# ADR-005: Drizzle como ORM/migrations e a estratégia de enforcement de RLS

## Contexto
O `CLAUDE.md` citava **Prisma** como ORM primário e **Drizzle** como alternativa aprovada. Com o
isolamento multi-tenant forçado no banco (ADR-001) sobre Supabase (ADR-004), a peça crítica é
**como a RLS é realmente aplicada em tempo de execução** — não basta declarar políticas, é preciso
garantir que toda query do app rode sob um papel sujeito à RLS e com o tenant corrente no contexto.

## Decisão
Usar **Drizzle ORM + drizzle-kit** para schema e **migrations versionadas em SQL**, e enforçar a
RLS pelo padrão de **GUC de sessão por request sob papel não-privilegiado**:

1. **Schema e políticas RLS vivem na mesma migration versionada** (SQL-first do Drizzle) — toda
   tabela nova nasce com `tenant_id` + `ENABLE`/`FORCE ROW LEVEL SECURITY` + política, honrando a
   regra de ouro do `CLAUDE.md`.
2. **Papel de aplicação dedicado, não-superusuário** (sujeito à RLS), distinto do `service_role`
   do Supabase (que faz bypass e só é usado em rotinas administrativas controladas). `FORCE ROW
   LEVEL SECURITY` garante que nem o dono da tabela escapa.
3. **Tenant corrente por transação**: cada request autenticado abre uma transação e executa
   `SET LOCAL app.current_tenant = <uuid>`; as políticas filtram por
   `current_setting('app.current_tenant', true)::uuid = tenant_id`.
4. **Defesa em profundidade**: mesmo que um caso de uso esqueça o `WHERE tenant_id`, a RLS no banco
   bloqueia o vazamento — exatamente o que o ADR-001 exige.

Drizzle é escolhido sobre Prisma porque o SQL-first dá ergonomia direta para escrever e versionar
políticas RLS e o controle de conexão/role por request, sem cola de SQL raw em cima de um ORM que
abstrai a conexão.

## Alternativas consideradas
- **Prisma**: melhor DX de CRUD, mas RLS exige políticas via SQL raw fora do modelo e gerência
  manual de conexão/role por request — mais cola para o caso multi-tenant. Descartado como primário.
- **RLS via PostgREST/supabase-js (JWT → política)**: enforcement automático pelo token, porém
  amarra o acesso a dados ao cliente Supabase e dificulta a camada de domínio desacoplada que o
  ADR-003 pede. Fica como caminho do **portal público** (token de escopo mínimo), não do core.
- **Sem GUC, só `WHERE tenant_id` na aplicação**: já descartado no ADR-001 (frágil).

## Consequência
Migrations portáveis e políticas RLS versionadas junto do schema; isolamento provável por teste de
integração (tenant A não lê dados de B — Definition of Done da US-01). Custo: o acesso a dados passa
por um helper que abre transação + `SET LOCAL` por request (encapsulado na camada de infra), e há um
papel de banco dedicado a provisionar nas migrations. O `CLAUDE.md` é atualizado para refletir
Drizzle como ORM efetivo.
