import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenant } from "./tenant";

/**
 * Cargo (P-1): função da pessoa na oficina, configurável por tenant. `nome` é livre; `permissoes`
 * são chaves de um CATÁLOGO FIXO que o domínio (`domain/auth/cargo.ts`) sabe fazer valer. Cargos
 * `sistema` são semeados e têm permissões travadas (nome editável). `chao=true` = cargo de quiosque
 * (não vê dinheiro). `exige2fa` é piso: um gatilho força true, o dono nunca rebaixa. RLS por tenant.
 */
export const cargo = pgTable("cargo", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  sistema: boolean("sistema").notNull().default(false),
  chao: boolean("chao").notNull().default(false),
  permissoes: text("permissoes").array().notNull().default([]),
  exige2fa: boolean("exige_2fa").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
