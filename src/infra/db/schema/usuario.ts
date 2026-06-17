import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { papelUsuario } from "./enums";
import { tenant } from "./tenant";

/**
 * Usuário da oficina. `email` é único globalmente (identidade de login — alinhado à
 * unicidade de e-mail do provedor de auth). A unicidade vale entre tenants de propósito:
 * o mesmo e-mail não cadastra em duas oficinas (US-01: "email duplicado tratado").
 */
export const usuario = pgTable(
  "usuario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    email: text("email").notNull(),
    papel: papelUsuario("papel").notNull(),
    tfaAtivo: boolean("tfa_ativo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("usuario_email_unico").on(t.email)],
);
