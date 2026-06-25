import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { statusOrcamento } from "./enums";
import { os } from "./os";
import { tenant } from "./tenant";

/**
 * Orçamento da OS (M5 / US-12). Um por OS. `status` segue a máquina do domínio
 * (rascunho→enviado→aprovado/recusado). O link do cliente carrega um token cujo **hash** fica aqui
 * (nunca o token cru, como na recuperação de senha), com expiração — consumido pelo portal (M6).
 */
export const orcamento = pgTable(
  "orcamento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    osId: uuid("os_id")
      .notNull()
      .references(() => os.id, { onDelete: "cascade" }),
    status: statusOrcamento("status").notNull().default("rascunho"),
    tokenHash: text("token_hash"),
    tokenExpiraEm: timestamp("token_expira_em", { withTimezone: true }),
    enviadoEm: timestamp("enviado_em", { withTimezone: true }),
    aprovadoEm: timestamp("aprovado_em", { withTimezone: true }),
    recusadoEm: timestamp("recusado_em", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("orcamento_os_unico").on(t.osId)],
);
