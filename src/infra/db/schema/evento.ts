import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { estadoOs, origemEvento } from "./enums";
import { os } from "./os";
import { tenant } from "./tenant";
import { usuario } from "./usuario";

/**
 * Evento de transição da OS (de/para/quem/quando/motivo/origem) — a linha do tempo e a prova de
 * garantia (RF-11). `de_estado` é nulo na abertura. `origem` mede a ADOÇÃO DO CHÃO (chão vs escritório).
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
  origem: origemEvento("origem").notNull().default("escritorio"),
  em: timestamp("em", { withTimezone: true }).notNull().defaultNow(),
});
