-- RLS multi-tenant da conta a receber (P-4a). Mesmo padrão do 0023_rls_cargo:
-- GRANT ao app_user + ENABLE (SEM FORCE) + política de isolamento por tenant.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "conta_receber" TO app_user;--> statement-breakpoint

ALTER TABLE "conta_receber" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY conta_receber_tenant_isolation ON "conta_receber"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
