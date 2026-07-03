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
    // Link lógico para `auth.users.id` do Supabase (ADR-006). SEM FK rígida de propósito:
    // a tabela `auth.users` só existe no Postgres do Supabase, não no Postgres leve de testes.
    // Nulo enquanto o usuário não tem identidade (ex.: convidado); o onboarding preenche.
    authUserId: uuid("auth_user_id").unique(),
    nome: text("nome").notNull(),
    email: text("email").notNull(),
    papel: papelUsuario("papel").notNull(),
    tfaAtivo: boolean("tfa_ativo").notNull().default(false),
    // Convite de equipe (I1): membro desativado perde o acesso (a sessão deixa de resolver perfil)
    // sem apagar a história. Nulo = ativo. Quem está fora da firma não entra mais.
    desativadoEm: timestamp("desativado_em", { withTimezone: true }),
    // Quiosque de setor (P-0): hash do PIN de 4 dígitos que CARIMBA quem avançou no chão.
    // Só produção usa; nulo para os demais. Nunca o PIN cru — sha256, como o token do portal.
    pinHash: text("pin_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("usuario_email_unico").on(t.email)],
);
