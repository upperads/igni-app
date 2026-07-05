import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { modoTela } from "./enums";
import { estacao } from "./estacao";
import { tenant } from "./tenant";
import { usuario } from "./usuario";

/**
 * Tela (P-3): a "TV do setor" como DISPOSITIVO, no molde do quiosque. Credencial forte de dispositivo
 * (token de 32 bytes; só o `token_hash` mora aqui). O escritório controla remotamente o que ela mostra
 * (`modo` estacao|geral + `estacao_id`); a TV relê ao receber o ping do realtime. Read-only: a tela só
 * EXIBE o painel. Longo-viva (fica na parede); o controle é a REVOGAÇÃO manual (`revogado_em`).
 */
export const tela = pgTable("tela", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  modo: modoTela("modo").notNull(),
  estacaoId: uuid("estacao_id").references(() => estacao.id, { onDelete: "set null" }),
  tokenHash: text("token_hash").notNull().unique(),
  codigoCurto: text("codigo_curto").notNull().unique(),
  criadoPor: uuid("criado_por").references(() => usuario.id, { onDelete: "set null" }),
  revogadoEm: timestamp("revogado_em", { withTimezone: true }),
  ultimoUsoEm: timestamp("ultimo_uso_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
