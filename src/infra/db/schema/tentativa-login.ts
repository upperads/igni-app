import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Tentativas de login FALHAS, por e-mail, para o lockout (RNF-SEC-05).
 *
 * Tabela de infraestrutura de auth: acessada apenas pelo caminho PRIVILEGIADO durante o login,
 * antes de existir um tenant na sessão (análoga a `auth.users`). Por isso NÃO tem `tenant_id`
 * nem GRANT para `app_user`. A migration ainda liga RLS (ENABLE+FORCE) sem política — negando
 * acesso a qualquer papel não-privilegiado (defesa em profundidade). Num login bem-sucedido, as
 * linhas do e-mail são apagadas (reset do contador).
 */
export const tentativaLogin = pgTable(
  "tentativa_login",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    ocorridoEm: timestamp("ocorrido_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tentativa_login_email_ocorrido_idx").on(t.email, t.ocorridoEm)],
);
