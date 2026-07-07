import { integer, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { statusConta } from "./enums";
import { orcamento } from "./orcamento";
import { os } from "./os";
import { tenant } from "./tenant";

/**
 * Conta a receber (P-4a): nasce quando o orçamento é aprovado, com o total capturado no momento.
 * Linha do tempo do dinheiro (aberta→recebida/cancelada), independente do estado físico da OS.
 * Uma por orçamento (unique). Config por tenant, com RLS.
 */
export const contaReceber = pgTable(
  "conta_receber",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    osId: uuid("os_id")
      .notNull()
      .references(() => os.id, { onDelete: "cascade" }),
    orcamentoId: uuid("orcamento_id")
      .notNull()
      .references(() => orcamento.id, { onDelete: "cascade" }),
    valorCentavos: integer("valor_centavos").notNull(),
    status: statusConta("status").notNull().default("aberta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("conta_receber_orcamento_unico").on(t.orcamentoId)],
);
