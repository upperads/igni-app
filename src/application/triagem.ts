import { and, eq } from "drizzle-orm";
import {
  CONFIG_TRIAGEM_PADRAO,
  type ConfigTriagem,
  diasRestantesAte,
  gatilhosAtivos,
  type Prioridade,
  razaoCritica,
  type Responsabilidade,
  trabalhoRestante,
} from "@/domain/os/triagem";
import { OsNaoEncontradaError } from "@/domain/shared/errors";
import type { Database, TenantTx } from "@/infra/db/connection";
import { ajustePrioridade, cliente, entrada, equipamento, evento, os } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

export interface ResultadoPrioridade {
  score: number;
  prioridade: Prioridade;
}

/**
 * US-07 — lê os insumos da OS dentro do `tx`, calcula a razão crítica + gatilhos e PERSISTE
 * `prioridade_score` e a prioridade efetiva (`override ?? calculada`). Operar sobre um `tx` já
 * aberto deixa esta função reutilizável tanto em um caso de uso próprio quanto embutida noutro.
 */
export async function aplicarPrioridade(
  tx: TenantTx,
  osId: string,
  agora: Date,
  config: ConfigTriagem = CONFIG_TRIAGEM_PADRAO,
): Promise<ResultadoPrioridade> {
  const [linha] = await tx
    .select({
      estado: os.estado,
      prazoPrometido: os.prazoPrometido,
      prioridadeOverride: os.prioridadeOverride,
      tipoCliente: cliente.tipo,
      maquinaUnica: equipamento.maquinaUnica,
    })
    .from(os)
    .innerJoin(equipamento, eq(equipamento.id, os.equipamentoId))
    .innerJoin(entrada, eq(entrada.id, os.entradaId))
    .innerJoin(cliente, eq(cliente.id, entrada.clienteId))
    .where(eq(os.id, osId))
    .limit(1);

  if (!linha) {
    throw new OsNaoEncontradaError(osId);
  }

  // Retrabalho de garantia: houve CQ reprovado (controle_qualidade → execucao) na linha do tempo?
  const reprovacoes = await tx
    .select({ id: evento.id })
    .from(evento)
    .where(
      and(
        eq(evento.osId, osId),
        eq(evento.deEstado, "controle_qualidade"),
        eq(evento.paraEstado, "execucao"),
      ),
    )
    .limit(1);

  const gatilhos = gatilhosAtivos({
    tipoCliente: linha.tipoCliente,
    maquinaUnica: linha.maquinaUnica,
    houveCqReprovado: reprovacoes.length > 0,
  });

  const { score, prioridade: calculada } = razaoCritica(
    {
      diasRestantes: diasRestantesAte(linha.prazoPrometido, agora),
      trabalhoRestante: trabalhoRestante(linha.estado),
      gatilhos,
    },
    config,
  );

  const efetiva: Prioridade = linha.prioridadeOverride ?? calculada;
  await tx.update(os).set({ prioridadeScore: score, prioridade: efetiva }).where(eq(os.id, osId));

  return { score, prioridade: efetiva };
}

/** Recalcula e persiste a prioridade de uma OS (caso de uso próprio, abre o `withTenant`). */
export function recalcularPrioridade(
  database: Database,
  sessao: SessaoTenant,
  osId: string,
  agora: Date = new Date(),
): Promise<ResultadoPrioridade> {
  return database.withTenant(sessao.tenantId, (tx) => aplicarPrioridade(tx, osId, agora));
}

export interface AjustarPrioridadeInput {
  osId: string;
  prioridade: Prioridade;
  motivo?: string;
}

/**
 * US-07 — override humano: fixa a prioridade (vence o cálculo) e REGISTRA quem/quando/de→para/motivo
 * em `ajuste_prioridade`. O score calculado é preservado para transparência.
 */
export function ajustarPrioridade(
  database: Database,
  sessao: SessaoTenant,
  input: AjustarPrioridadeInput,
): Promise<ResultadoPrioridade> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [atual] = await tx
      .select({ prioridade: os.prioridade, score: os.prioridadeScore })
      .from(os)
      .where(eq(os.id, input.osId))
      .limit(1);

    if (!atual) {
      throw new OsNaoEncontradaError(input.osId);
    }

    await tx
      .update(os)
      .set({ prioridadeOverride: input.prioridade, prioridade: input.prioridade })
      .where(eq(os.id, input.osId));

    await tx.insert(ajustePrioridade).values({
      tenantId: sessao.tenantId,
      osId: input.osId,
      dePrioridade: atual.prioridade,
      paraPrioridade: input.prioridade,
      motivo: input.motivo,
      porUsuarioId: sessao.usuarioId,
    });

    return { score: atual.score, prioridade: input.prioridade };
  });
}

export interface TravarInput {
  osId: string;
  motivo: string;
  responsabilidade: Responsabilidade;
}

/** US-08 — trava a OS (dimensão separada da prioridade) com motivo e responsabilidade (RN-03). */
export function travar(database: Database, sessao: SessaoTenant, input: TravarInput): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [atual] = await tx.select({ id: os.id }).from(os).where(eq(os.id, input.osId)).limit(1);
    if (!atual) {
      throw new OsNaoEncontradaError(input.osId);
    }
    await tx
      .update(os)
      .set({
        travado: true,
        travamentoMotivo: input.motivo,
        travamentoResponsabilidade: input.responsabilidade,
      })
      .where(eq(os.id, input.osId));
  });
}

/** US-08 — destrava a OS, limpando motivo e responsabilidade. */
export function destravar(database: Database, sessao: SessaoTenant, osId: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [atual] = await tx.select({ id: os.id }).from(os).where(eq(os.id, osId)).limit(1);
    if (!atual) {
      throw new OsNaoEncontradaError(osId);
    }
    await tx
      .update(os)
      .set({ travado: false, travamentoMotivo: null, travamentoResponsabilidade: null })
      .where(eq(os.id, osId));
  });
}
