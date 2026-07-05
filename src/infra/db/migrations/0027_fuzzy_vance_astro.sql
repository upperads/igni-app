CREATE INDEX "os_tenant_estado_idx" ON "os" USING btree ("tenant_id","estado");--> statement-breakpoint
CREATE INDEX "evento_tenant_em_idx" ON "evento" USING btree ("tenant_id","em");--> statement-breakpoint
CREATE INDEX "evento_os_idx" ON "evento" USING btree ("os_id");--> statement-breakpoint
CREATE INDEX "orcamento_item_orcamento_idx" ON "orcamento_item" USING btree ("orcamento_id");