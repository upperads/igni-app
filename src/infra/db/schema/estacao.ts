import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenant } from "./tenant";

/**
 * Estação de trabalho do setor (ex.: bloco, cabeçote, virabrequim). Pré-carregada na
 * criação da oficina a partir do template do ramo (US-01/US-16). `ordem` define a posição
 * no fluxo. Configurável por tenant (M8) — aqui é o destino do seed do template.
 */
export const estacao = pgTable("estacao", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  ordem: integer("ordem").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
