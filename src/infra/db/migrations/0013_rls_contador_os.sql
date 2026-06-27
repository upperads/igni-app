-- RLS da tabela-contador de OS (ADR-011). Mesmo padrão (GRANT app_user + ENABLE sem FORCE + policy
-- de isolamento por tenant). O contador é escrito no caminho withTenant (abrir OS), sob RLS.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "tenant_contador_os" TO app_user;--> statement-breakpoint

ALTER TABLE "tenant_contador_os" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY tenant_contador_os_isolation ON "tenant_contador_os"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);