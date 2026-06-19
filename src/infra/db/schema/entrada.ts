import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { cliente } from "./cliente";
import { modalidadeEntrada } from "./enums";
import { tenant } from "./tenant";

/** Entrada de um serviço (modalidade A/B/C), com peças recebidas e fotos. Origina uma ou mais OS. */
export const entrada = pgTable("entrada", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  clienteId: uuid("cliente_id")
    .notNull()
    .references(() => cliente.id, { onDelete: "restrict" }),
  modalidade: modalidadeEntrada("modalidade").notNull(),
  pecasRecebidas: jsonb("pecas_recebidas"),
  fotos: jsonb("fotos"),
  dataEntrada: timestamp("data_entrada", { withTimezone: true }).notNull().defaultNow(),
});
