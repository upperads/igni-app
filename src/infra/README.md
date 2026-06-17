# `src/infra` — Infraestrutura (DB e integrações)

Detalhes externos: cliente/conexão do Postgres (Supabase) e schema/queries do **Drizzle**,
clientes de Auth/Realtime do Supabase, e integrações (ex.: WhatsApp no M7). É a única camada
que conhece IO. O enforcement de RLS (papel não-privilegiado + `SET LOCAL app.current_tenant`
por transação, ADR-005) vive aqui, encapsulado num helper de acesso a dados por tenant.
