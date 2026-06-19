-- RLS multi-tenant das tabelas do M2 (cliente, equipamento, entrada, os, evento).
-- Padrão: GRANT ao app_user + ENABLE (SEM FORCE, p/ o caminho privilegiado dono/postgres bypassar
-- como no ADR-005/0005) + política de isolamento por tenant. `app_user` já existe (migration 0001).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "cliente" TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "equipamento" TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "entrada" TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "os" TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "evento" TO app_user;--> statement-breakpoint

ALTER TABLE "cliente" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "equipamento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "entrada" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "os" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "evento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY cliente_tenant_isolation ON "cliente"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);--> statement-breakpoint
CREATE POLICY equipamento_tenant_isolation ON "equipamento"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);--> statement-breakpoint
CREATE POLICY entrada_tenant_isolation ON "entrada"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);--> statement-breakpoint
CREATE POLICY os_tenant_isolation ON "os"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);--> statement-breakpoint
CREATE POLICY evento_tenant_isolation ON "evento"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
