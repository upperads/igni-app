import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { cliente } from "./cliente";
import { tenant } from "./tenant";

/**
 * Equipamento/motor do cliente. Placa e chassi são dados pessoais (LGPD): mascarar em logs/telas.
 * `maquina_unica` alimenta o gatilho de triagem do produtor (M3).
 */
export const equipamento = pgTable("equipamento", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  clienteId: uuid("cliente_id")
    .notNull()
    .references(() => cliente.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(),
  placa: text("placa"),
  chassi: text("chassi"),
  modeloMotor: text("modelo_motor"),
  maquinaUnica: boolean("maquina_unica").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
