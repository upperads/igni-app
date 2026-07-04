-- RLS multi-tenant dos cargos (P-1). Mesmo padrão do 0021_rls_servico:
-- GRANT ao app_user + ENABLE (SEM FORCE) + política de isolamento por tenant.
-- `app_user` já existe (migration 0001).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "cargo" TO app_user;--> statement-breakpoint

ALTER TABLE "cargo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY cargo_tenant_isolation ON "cargo"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
