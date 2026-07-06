import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenant } from "./tenant";

/**
 * Setor (P-5a): agrupamento físico de estações (ex.: Usinagem = bloco + cabeçote + virabrequim…).
 * A TV mostra um setor inteiro. `estacao.setor_id` aponta para cá. Config por tenant, com RLS.
 */
export const setor = pgTable("setor", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  ordem: integer("ordem").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
