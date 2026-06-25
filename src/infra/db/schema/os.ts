import {
  boolean,
  date,
  doublePrecision,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { entrada } from "./entrada";
import { equipamento } from "./equipamento";
import { estacao } from "./estacao";
import { estadoOs, prioridadeOs, responsabilidade } from "./enums";
import { tenant } from "./tenant";
import { usuario } from "./usuario";

/**
 * Ordem de serviço — núcleo do M2. `estado` é dirigido pela máquina de estados (ADR-008).
 * Prioridade e travamento (M3) entram como colunas depois. `entrou_no_estado_em` mede tempo parado.
 */
export const os = pgTable("os", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  entradaId: uuid("entrada_id")
    .notNull()
    .references(() => entrada.id, { onDelete: "restrict" }),
  equipamentoId: uuid("equipamento_id")
    .notNull()
    .references(() => equipamento.id, { onDelete: "restrict" }),
  estacaoId: uuid("estacao_id").references(() => estacao.id, { onDelete: "set null" }),
  responsavelId: uuid("responsavel_id").references(() => usuario.id, { onDelete: "set null" }),
  tipoServico: text("tipo_servico"),
  estado: estadoOs("estado").notNull().default("aberta"),
  // Triagem (M3 / ADR-009). `prioridade` = bucket efetivo (override ?? calculado); `score` = urgência
  // calculada; `override` = pino humano (nulável). Travamento é dimensão SEPARADA da prioridade.
  prioridade: prioridadeOs("prioridade").notNull().default("normal"),
  prioridadeScore: doublePrecision("prioridade_score").notNull().default(0),
  prioridadeOverride: prioridadeOs("prioridade_override"),
  travado: boolean("travado").notNull().default(false),
  travamentoMotivo: text("travamento_motivo"),
  travamentoResponsabilidade: responsabilidade("travamento_responsabilidade"),
  // Gate do CQ (RN-01): aprovação do controle de qualidade. Resetada ao reentrar no CQ (retrabalho).
  cqAprovado: boolean("cq_aprovado").notNull().default(false),
  prazoPrometido: date("prazo_prometido"),
  entrouNoEstadoEm: timestamp("entrou_no_estado_em", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
