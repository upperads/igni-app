-- `tentativa_login` é tabela de infraestrutura de auth: só o caminho privilegiado (postgres,
-- bypass de RLS) acessa, durante o login. Ligamos RLS ENABLE+FORCE e NÃO criamos política nem
-- damos GRANT a `app_user` — assim qualquer papel não-privilegiado fica sem acesso (deny-all).
ALTER TABLE "tentativa_login" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tentativa_login" FORCE ROW LEVEL SECURITY;
