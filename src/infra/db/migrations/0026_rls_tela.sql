-- RLS multi-tenant das telas (P-3). Mesmo padrão do 0023_rls_cargo:
-- GRANT ao app_user + ENABLE (SEM FORCE) + política de isolamento por tenant.
-- `app_user` já existe (migration 0001).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "tela" TO app_user;--> statement-breakpoint

ALTER TABLE "tela" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY tela_tenant_isolation ON "tela"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
