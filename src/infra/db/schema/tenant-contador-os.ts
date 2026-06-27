import { integer, pgTable, uuid } from "drizzle-orm/pg-core";
import { tenant } from "./tenant";

/**
 * Contador de número de OS por tenant (ADR-011). `proximo` = próximo número a atribuir. A numeração
 * race-safe vem do lock de linha do `UPDATE ... RETURNING` dentro da transação de abrir OS.
 */
export const tenantContadorOs = pgTable("tenant_contador_os", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenant.id, { onDelete: "cascade" }),
  proximo: integer("proximo").notNull().default(1),
});
