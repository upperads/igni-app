-- RLS multi-tenant (ADR-001 / ADR-005). Enforcement em runtime: o helper `withTenant`
-- faz `set_config('app.current_tenant', ..., true)` + `set local role app_user` por transação.

-- Papel de aplicação NÃO-privilegiado (sujeito à RLS). Idempotente: é cluster-global e
-- sobrevive ao reset de schema dos testes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;--> statement-breakpoint

-- Privilégios de tabela. O GRANT só abre a porta; quem filtra as linhas é a RLS.
GRANT USAGE ON SCHEMA public TO app_user;--> statement-breakpoint
GRANT SELECT ON TABLE "tenant" TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "usuario" TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "estacao" TO app_user;--> statement-breakpoint

-- Liga e FORÇA a RLS (FORCE: nem o dono da tabela escapa — defesa em profundidade).
ALTER TABLE "tenant" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usuario" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usuario" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "estacao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "estacao" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- Políticas de isolamento. `current_setting(..., true)` devolve NULL se o GUC não foi setado
-- → comparação falsa → nenhuma linha (fail-closed). Sem tenant na transação, nada vaza.
CREATE POLICY tenant_isolation_self ON "tenant"
  USING (id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (id = current_setting('app.current_tenant', true)::uuid);--> statement-breakpoint
CREATE POLICY usuario_tenant_isolation ON "usuario"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);--> statement-breakpoint
CREATE POLICY estacao_tenant_isolation ON "estacao"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
