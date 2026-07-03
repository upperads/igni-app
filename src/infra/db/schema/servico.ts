import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tipoItemOrcamento } from "./enums";
import { tenant } from "./tenant";

/**
 * Catálogo de serviços por tenant (P-2). Fonte de SUGESTÃO de preço: o orçamento COPIA o serviço para
 * uma linha editável (sem FK), então mudar/desativar um serviço nunca altera orçamentos já feitos.
 * `tipo` reusa o enum do item de orçamento (fala a mesma língua da linha). Dinheiro em centavos inteiros.
 * `ativo` desativa sem apagar (preserva histórico). Config por tenant com RLS (padrão da `estacao`).
 */
export const servico = pgTable("servico", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  tipo: tipoItemOrcamento("tipo").notNull(),
  valorCentavos: integer("valor_centavos").notNull(),
  markupPct: integer("markup_pct").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
