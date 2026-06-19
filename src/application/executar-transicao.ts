import { eq } from "drizzle-orm";
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
      .set({ estado: input.para, entrouNoEstadoEm: new Date() })
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
