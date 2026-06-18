-- Compatibilidade com o Supabase hospedado (ADR-006/007).
--
-- No Postgres local o papel de conexão (`postgres`) é SUPERUSUÁRIO e ignora a RLS, então o
-- caminho privilegiado (onboarding, lockout, bootstrap de perfil) funciona mesmo com FORCE. No
-- Supabase hospedado o `postgres` NÃO é superusuário e é DONO das tabelas: com FORCE, ele ficaria
-- sujeito à RLS e os INSERTs privilegiados seriam bloqueados.
--
-- Correção: tirar o FORCE. Sem FORCE, o DONO (postgres) é naturalmente isento — é o nosso caminho
-- privilegiado — e o `app_user` (não-dono) continua sujeito à RLS (ENABLE), que é o que garante o
-- isolamento por tenant. A defesa em profundidade contra uso indevido do `db` privilegiado passa a
-- ser a guarda de import no ESLint (camada web não importa o `db`).
ALTER TABLE "tenant" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usuario" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "estacao" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tentativa_login" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- Para o `withTenant` fazer `SET LOCAL ROLE app_user`, o papel de conexão precisa ser MEMBRO de
-- app_user. Local (superuser) já podia; no hospedado é obrigatório. Idempotente.
GRANT app_user TO postgres;
