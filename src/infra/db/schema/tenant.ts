import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { templateRamo } from "./enums";

/**
 * Oficina (tenant). Raiz do isolamento multi-tenant (ADR-001). Não tem `tenant_id`
 * porque ELA É o tenant: a RLS restringe cada oficina a enxergar apenas a própria linha.
 */
export const tenant = pgTable("tenant", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  templateRamo: templateRamo("template_ramo").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
