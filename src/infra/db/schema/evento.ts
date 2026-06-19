import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { estadoOs } from "./enums";
import { os } from "./os";
import { tenant } from "./tenant";
import { usuario } from "./usuario";

/**
 * Evento de transição da OS (de/para/quem/quando/motivo) — a linha do tempo e a prova de garantia
 * (RF-11). `de_estado` é nulo no evento de abertura. Toda transição válida grava um evento.
 */
export const evento = pgTable("evento", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  osId: uuid("os_id")
    .notNull()
    .references(() => os.id, { onDelete: "cascade" }),
  deEstado: estadoOs("de_estado"),
  paraEstado: estadoOs("para_estado").notNull(),
  porUsuarioId: uuid("por_usuario_id").references(() => usuario.id, { onDelete: "set null" }),
  motivo: text("motivo"),
  em: timestamp("em", { withTimezone: true }).notNull().defaultNow(),
});
