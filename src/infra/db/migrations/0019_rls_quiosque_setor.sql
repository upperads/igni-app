-- RLS multi-tenant do quiosque de setor (P-0). Mesmo padrão do 0007/0011:
-- GRANT ao app_user + ENABLE (SEM FORCE) + política de isolamento por tenant.
-- `app_user` já existe (migration 0001).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "quiosque_setor" TO app_user;--> statement-breakpoint

ALTER TABLE "quiosque_setor" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY quiosque_setor_tenant_isolation ON "quiosque_setor"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
