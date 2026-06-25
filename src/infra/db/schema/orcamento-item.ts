import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tipoItemOrcamento } from "./enums";
import { orcamento } from "./orcamento";
import { tenant } from "./tenant";

/**
 * Item do orçamento (M5). Dinheiro em **centavos inteiros** (evita drift de ponto flutuante); markup
 * em **percentual inteiro** (terceiro com %). O total do item = valor + valor*markup/100.
 */
export const orcamentoItem = pgTable("orcamento_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  orcamentoId: uuid("orcamento_id")
    .notNull()
    .references(() => orcamento.id, { onDelete: "cascade" }),
  tipo: tipoItemOrcamento("tipo").notNull(),
  descricao: text("descricao").notNull(),
  valorCentavos: integer("valor_centavos").notNull(),
  markupPct: integer("markup_pct").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
