import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { estacao } from "./estacao";
import { tenant } from "./tenant";
import { usuario } from "./usuario";

/**
 * Quiosque de setor (P-0): o "tablet logado no setor". Credencial forte de DISPOSITIVO
 * (token de 32 bytes; só o `token_hash` mora aqui, como o portal). Escopo mínimo: só serve
 * uma estação. Longo-vivo (fica no tablet); o controle é a REVOGAÇÃO manual (`revogado_em`).
 * O `codigo_curto` é atalho de backup pra ligar (troca-se pelo token; não é credencial permanente).
 */
export const quiosqueSetor = pgTable("quiosque_setor", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  estacaoId: uuid("estacao_id")
    .notNull()
    .references(() => estacao.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  codigoCurto: text("codigo_curto").notNull().unique(),
  criadoPor: uuid("criado_por").references(() => usuario.id, { onDelete: "set null" }),
  revogadoEm: timestamp("revogado_em", { withTimezone: true }),
  ultimoUsoEm: timestamp("ultimo_uso_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
