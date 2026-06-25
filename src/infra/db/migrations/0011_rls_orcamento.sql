-- RLS multi-tenant das tabelas de orçamento (M5 / US-12). Mesmo padrão do 0007/0009:
-- GRANT ao app_user + ENABLE (SEM FORCE, p/ o caminho privilegiado bypassar como no ADR-005/0005)
-- + política de isolamento por tenant. `app_user` já existe (migration 0001).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "orcamento" TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "orcamento_item" TO app_user;--> statement-breakpoint

ALTER TABLE "orcamento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orcamento_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY orcamento_tenant_isolation ON "orcamento"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);--> statement-breakpoint
CREATE POLICY orcamento_item_tenant_isolation ON "orcamento_item"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);