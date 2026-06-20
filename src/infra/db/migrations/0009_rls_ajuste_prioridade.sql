-- RLS multi-tenant da tabela de auditoria de override de prioridade (M3 / ADR-009).
-- Mesmo padrão do 0007: GRANT ao app_user + ENABLE (SEM FORCE, p/ o caminho privilegiado bypassar
-- como no ADR-005/0005) + política de isolamento por tenant. `app_user` já existe (migration 0001).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ajuste_prioridade" TO app_user;--> statement-breakpoint

ALTER TABLE "ajuste_prioridade" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY ajuste_prioridade_tenant_isolation ON "ajuste_prioridade"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);