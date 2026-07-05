import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
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
 * `numero` é sequencial POR TENANT ("OS-41"), gerado via tabela-contador (ADR-011).
 */
export const os = pgTable(
  "os",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    numero: integer("numero").notNull(),
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
  // Seed de demonstração (I5): OS criada pelo "Preencher com exemplo". Marca o que o "Limpar
  // demonstração" pode apagar — o banco real nunca fica sujo. Não filtra leitura (a demo MOSTRA tudo).
  isDemo: boolean("is_demo").notNull().default(false),
    prazoPrometido: date("prazo_prometido"),
    entrouNoEstadoEm: timestamp("entrou_no_estado_em", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("os_numero_tenant").on(t.tenantId, t.numero),
    // Perf: painel/triagem lêem as OS ativas do tenant (`estado != 'entregue'`) a cada navegação.
    index("os_tenant_estado_idx").on(t.tenantId, t.estado),
  ],
);
