-- RLS multi-tenant do catálogo de serviços (P-2). Mesmo padrão do 0011/0019:
-- GRANT ao app_user + ENABLE (SEM FORCE) + política de isolamento por tenant.
-- `app_user` já existe (migration 0001).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "servico" TO app_user;--> statement-breakpoint

ALTER TABLE "servico" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY servico_tenant_isolation ON "servico"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
