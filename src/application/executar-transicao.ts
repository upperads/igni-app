import { desc, eq } from "drizzle-orm";
import { type ContextoTransicao, type EstadoOS, validarTransicao } from "@/domain/os/estado";
import { OsNaoEncontradaError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { evento, os } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

export interface ExecutarTransicaoInput {
  osId: string;
  para: EstadoOS;
  contexto: ContextoTransicao;
  motivo?: string;
}

export interface ResultadoExecucao {
  ok: boolean;
  /** Quando barrada por gate/estrutura, explica o que falta. */
  motivo?: string;
  estado?: EstadoOS;
}

/**
 * US-05 — move a OS pela máquina de estados (ADR-008) validando os gates, e grava o EVENTO da
 * transição (de/para/quem/quando/motivo). Escopado ao tenant (`withTenant`). Transição barrada não
 * muda nada e devolve o motivo (prevenção de erro).
 */
export async function executarTransicao(
  database: Database,
  sessao: SessaoTenant,
  input: ExecutarTransicaoInput,
): Promise<ResultadoExecucao> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [atual] = await tx
      .select({ estado: os.estado })
      .from(os)
      .where(eq(os.id, input.osId))
      .limit(1);

    if (!atual) {
      throw new OsNaoEncontradaError(input.osId);
    }

    const veredito = validarTransicao(atual.estado, input.para, input.contexto);
    if (!veredito.ok) {
      return { ok: false, motivo: veredito.motivo };
    }

    await tx
      .update(os)
      .set({
        estado: input.para,
        entrouNoEstadoEm: new Date(),
        // Reentrar no CQ (retrabalho) zera a aprovação: cada rodada do CQ aprova de novo.
        ...(input.para === "controle_qualidade" ? { cqAprovado: false } : {}),
      })
      .where(eq(os.id, input.osId));

    await tx.insert(evento).values({
      tenantId: sessao.tenantId,
      osId: input.osId,
      deEstado: atual.estado,
      paraEstado: input.para,
      porUsuarioId: sessao.usuarioId,
      motivo: input.motivo,
    });

    return { ok: true, estado: input.para };
  });
}

/**
 * US-10 — recall (desfazer): reverte a última transição da OS, voltando ao estado anterior e
 * gravando o EVENTO do desfazer. É um undo explícito (não passa pela máquina pra frente). Não dá
 * para desfazer a abertura. Escopado ao tenant.
 */
export async function recallTransicao(
  database: Database,
  sessao: SessaoTenant,
  osId: string,
): Promise<ResultadoExecucao> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [ultimo] = await tx
      .select({ deEstado: evento.deEstado, paraEstado: evento.paraEstado })
      .from(evento)
      .where(eq(evento.osId, osId))
      .orderBy(desc(evento.em))
      .limit(1);

    if (!ultimo) {
      throw new OsNaoEncontradaError(osId);
    }
    if (ultimo.deEstado === null) {
      return { ok: false, motivo: "Não dá para desfazer a abertura da OS." };
    }

    await tx
      .update(os)
      .set({ estado: ultimo.deEstado, entrouNoEstadoEm: new Date() })
      .where(eq(os.id, osId));

    await tx.insert(evento).values({
      tenantId: sessao.tenantId,
      osId,
      deEstado: ultimo.paraEstado,
      paraEstado: ultimo.deEstado,
      porUsuarioId: sessao.usuarioId,
      motivo: "Recall (desfazer)",
    });

    return { ok: true, estado: ultimo.deEstado };
  });
}
