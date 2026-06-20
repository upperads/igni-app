import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { prioridadeOs } from "./enums";
import { os } from "./os";
import { tenant } from "./tenant";
import { usuario } from "./usuario";

/**
 * Registro de override de prioridade (M3 / US-07 / ADR-009): quem fixou, quando, de qual bucket
 * para qual, e por quê. É a prova de "todo override fica registrado" (RN-02). `de_prioridade` é
 * nulo quando o ajuste parte do valor calculado (sem override anterior).
 */
export const ajustePrioridade = pgTable("ajuste_prioridade", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  osId: uuid("os_id")
    .notNull()
    .references(() => os.id, { onDelete: "cascade" }),
  dePrioridade: prioridadeOs("de_prioridade"),
  paraPrioridade: prioridadeOs("para_prioridade").notNull(),
  motivo: text("motivo"),
  porUsuarioId: uuid("por_usuario_id").references(() => usuario.id, { onDelete: "set null" }),
  em: timestamp("em", { withTimezone: true }).notNull().defaultNow(),
});
