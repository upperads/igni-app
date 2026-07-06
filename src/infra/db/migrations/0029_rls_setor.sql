-- RLS multi-tenant dos setores (P-5a). Mesmo padrão do 0023_rls_cargo:
-- GRANT ao app_user + ENABLE (SEM FORCE) + política de isolamento por tenant.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "setor" TO app_user;--> statement-breakpoint

ALTER TABLE "setor" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY setor_tenant_isolation ON "setor"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
