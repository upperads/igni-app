import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tipoCliente } from "./enums";
import { tenant } from "./tenant";

/** Cliente da oficina (frota, produtor, avulso). */
export const cliente = pgTable("cliente", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  contatoWhatsapp: text("contato_whatsapp"),
  tipo: tipoCliente("tipo").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
