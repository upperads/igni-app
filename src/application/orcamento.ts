import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { ContextoTransicao, EstadoOS } from "@/domain/os/estado";
import {
  calcularOrcamento,
  type CanalAprovacao,
  motivoAprovacaoInterna,
  podeDecidir,
  podeEditarItens,
  podeEnviar,
  podeReabrir,
  type TipoItem,
} from "@/domain/orcamento/orcamento";
import { DadosInvalidosError, OsNaoEncontradaError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { contaReceber, evento, orcamento, orcamentoItem, os } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

const VALIDADE_TOKEN_DIAS = 7;

export interface ItemEntrada {
  tipo: TipoItem;
  descricao: string;
  valorCentavos: number;
  markupPct: number;
}

function validarItem(item: ItemEntrada): void {
  if (!item.descricao.trim()) {
    throw new DadosInvalidosError("Todo item do orçamento precisa de descrição.");
  }
  if (!Number.isInteger(item.valorCentavos) || item.valorCentavos < 0) {
    throw new DadosInvalidosError("Valor do item inválido.");
  }
  if (!Number.isInteger(item.markupPct) || item.markupPct < 0) {
    throw new DadosInvalidosError("Markup do item inválido.");
  }
}

/** US-12 — monta/edita o orçamento (cria em rascunho se preciso) e substitui os itens. */
export function montarOrcamento(
  database: Database,
  sessao: SessaoTenant,
  input: { osId: string; itens: ItemEntrada[] },
): Promise<{ orcamentoId: string }> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [ordem] = await tx.select({ id: os.id }).from(os).where(eq(os.id, input.osId)).limit(1);
    if (!ordem) {
      throw new OsNaoEncontradaError(input.osId);
    }

    const existente = (
      await tx
        .select({ id: orcamento.id, status: orcamento.status })
        .from(orcamento)
        .where(eq(orcamento.osId, input.osId))
        .limit(1)
    )[0];
    const orc =
      existente ??
      (
        await tx
          .insert(orcamento)
          .values({ tenantId: sessao.tenantId, osId: input.osId })
          .returning({ id: orcamento.id, status: orcamento.status })
      )[0]!;

    if (!podeEditarItens(orc.status)) {
      throw new DadosInvalidosError("O orçamento não está em rascunho; reabra para editar.");
    }
    input.itens.forEach(validarItem);

    await tx.delete(orcamentoItem).where(eq(orcamentoItem.orcamentoId, orc.id));
    if (input.itens.length > 0) {
      await tx.insert(orcamentoItem).values(
        input.itens.map((i) => ({
          tenantId: sessao.tenantId,
          orcamentoId: orc.id,
          tipo: i.tipo,
          descricao: i.descricao.trim(),
          valorCentavos: i.valorCentavos,
          markupPct: i.markupPct,
        })),
      );
    }
    return { orcamentoId: orc.id };
  });
}

/** US-12 — envia ao cliente: gera o token (guarda só o hash) + expiração e marca enviado. */
export function enviarOrcamento(
  database: Database,
  sessao: SessaoTenant,
  osId: string,
): Promise<{ token: string }> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [orc] = await tx
      .select({ id: orcamento.id, status: orcamento.status })
      .from(orcamento)
      .where(eq(orcamento.osId, osId))
      .limit(1);
    if (!orc) {
      throw new DadosInvalidosError("Monte o orçamento antes de enviar.");
    }
    const itens = await tx
      .select({ id: orcamentoItem.id })
      .from(orcamentoItem)
      .where(eq(orcamentoItem.orcamentoId, orc.id));
    if (!podeEnviar(orc.status, itens.length)) {
      throw new DadosInvalidosError("Para enviar, o orçamento precisa estar em rascunho e ter itens.");
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const tokenExpiraEm = new Date(Date.now() + VALIDADE_TOKEN_DIAS * 86_400_000);

    await tx
      .update(orcamento)
      .set({ status: "enviado", enviadoEm: new Date(), tokenHash, tokenExpiraEm })
      .where(eq(orcamento.id, orc.id));
    return { token };
  });
}

async function exigirOrcamentoDecidivel(
  tx: Parameters<Parameters<Database["withTenant"]>[1]>[0],
  osId: string,
): Promise<{ id: string }> {
  const [orc] = await tx
    .select({ id: orcamento.id, status: orcamento.status })
    .from(orcamento)
    .where(eq(orcamento.osId, osId))
    .limit(1);
  if (!orc) {
    throw new DadosInvalidosError("Orçamento não encontrado.");
  }
  if (!podeDecidir(orc.status)) {
    throw new DadosInvalidosError("Só dá para decidir um orçamento que foi enviado.");
  }
  return { id: orc.id };
}

/**
 * US-12/14 — aprova o orçamento (libera o gate de execução). Não avança a OS (pode ir a peça ou
 * execução). Quem aprova é a OPERAÇÃO (cliente aprovou por fora); o `canal` documenta COMO o cliente
 * aprovou e grava um evento na linha do tempo — a aprovação interna deixa de ser invisível, o que
 * preserva a responsabilização honesta (fica registrado que esperamos o cliente até aqui).
 * Sem `canal` (ex.: aprovação pelo portal do próprio cliente), não grava evento de canal.
 */
export function aprovarOrcamento(
  database: Database,
  sessao: SessaoTenant,
  osId: string,
  canal?: CanalAprovacao,
): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const orc = await exigirOrcamentoDecidivel(tx, osId);
    await tx
      .update(orcamento)
      .set({ status: "aprovado", aprovadoEm: new Date() })
      .where(eq(orcamento.id, orc.id));

    // P-4a: nasce/atualiza a conta a receber com o total aprovado (mesma transação).
    const itens = await tx
      .select({ tipo: orcamentoItem.tipo, valorCentavos: orcamentoItem.valorCentavos, markupPct: orcamentoItem.markupPct })
      .from(orcamentoItem)
      .where(eq(orcamentoItem.orcamentoId, orc.id));
    const { total } = calcularOrcamento(itens);

    const [contaExistente] = await tx
      .select({ id: contaReceber.id, status: contaReceber.status })
      .from(contaReceber)
      .where(eq(contaReceber.orcamentoId, orc.id))
      .limit(1);

    if (!contaExistente) {
      await tx.insert(contaReceber).values({
        tenantId: sessao.tenantId,
        osId,
        orcamentoId: orc.id,
        valorCentavos: total,
        status: "aberta",
      });
    } else if (contaExistente.status === "aberta") {
      await tx.update(contaReceber).set({ valorCentavos: total }).where(eq(contaReceber.id, contaExistente.id));
    } else if (contaExistente.status === "cancelada") {
      await tx.update(contaReceber).set({ valorCentavos: total, status: "aberta" }).where(eq(contaReceber.id, contaExistente.id));
    }
    // status === "recebida" → não toca (congela).

    if (canal) {
      const [ordem] = await tx.select({ estado: os.estado }).from(os).where(eq(os.id, osId)).limit(1);
      if (ordem) {
        await tx.insert(evento).values({
          tenantId: sessao.tenantId,
          osId,
          deEstado: ordem.estado,
          paraEstado: ordem.estado,
          porUsuarioId: sessao.usuarioId,
          motivo: motivoAprovacaoInterna(canal),
        });
      }
    }
  });
}

/** US-14 — recusa o orçamento e volta a OS a diagnóstico (renegociação), se estava aguardando aprovação. */
export function recusarOrcamento(
  database: Database,
  sessao: SessaoTenant,
  osId: string,
): Promise<{ estado: EstadoOS | null }> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const orc = await exigirOrcamentoDecidivel(tx, osId);
    await tx
      .update(orcamento)
      .set({ status: "recusado", recusadoEm: new Date() })
      .where(eq(orcamento.id, orc.id));

    const [ordem] = await tx.select({ estado: os.estado }).from(os).where(eq(os.id, osId)).limit(1);
    if (ordem?.estado === "aguardando_aprovacao") {
      await tx
        .update(os)
        .set({ estado: "diagnostico", entrouNoEstadoEm: new Date() })
        .where(eq(os.id, osId));
      await tx.insert(evento).values({
        tenantId: sessao.tenantId,
        osId,
        deEstado: "aguardando_aprovacao",
        paraEstado: "diagnostico",
        porUsuarioId: sessao.usuarioId,
        motivo: "Orçamento recusado",
      });
      return { estado: "diagnostico" };
    }
    return { estado: null };
  });
}

/** US-12 — reabre um orçamento recusado para renegociar (volta a rascunho, limpa o token). */
export function reabrirOrcamento(
  database: Database,
  sessao: SessaoTenant,
  osId: string,
): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [orc] = await tx
      .select({ id: orcamento.id, status: orcamento.status })
      .from(orcamento)
      .where(eq(orcamento.osId, osId))
      .limit(1);
    if (!orc) {
      throw new DadosInvalidosError("Orçamento não encontrado.");
    }
    if (!podeReabrir(orc.status)) {
      throw new DadosInvalidosError("Só um orçamento recusado pode ser reaberto.");
    }
    await tx
      .update(orcamento)
      .set({
        status: "rascunho",
        enviadoEm: null,
        recusadoEm: null,
        tokenHash: null,
        tokenExpiraEm: null,
      })
      .where(eq(orcamento.id, orc.id));
  });
}

/** US-12 (gate do CQ) — aprova o controle de qualidade da OS (libera CQ → pronta). */
export function aprovarCq(database: Database, sessao: SessaoTenant, osId: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [ordem] = await tx
      .select({ estado: os.estado })
      .from(os)
      .where(eq(os.id, osId))
      .limit(1);
    if (!ordem) {
      throw new OsNaoEncontradaError(osId);
    }
    if (ordem.estado !== "controle_qualidade") {
      throw new DadosInvalidosError("A OS não está no controle de qualidade.");
    }
    await tx.update(os).set({ cqAprovado: true }).where(eq(os.id, osId));
  });
}

/**
 * Resolve o contexto REAL dos gates (RN-01) para uma transição: orçamento aprovado + CQ aprovado.
 * Substitui o contexto cravado que o M2 usava — agora os gates leem o estado de verdade.
 */
export function resolverContextoGate(
  database: Database,
  sessao: SessaoTenant,
  osId: string,
): Promise<ContextoTransicao> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [ordem] = await tx
      .select({ cqAprovado: os.cqAprovado })
      .from(os)
      .where(eq(os.id, osId))
      .limit(1);
    if (!ordem) {
      throw new OsNaoEncontradaError(osId);
    }
    const [orc] = await tx
      .select({ status: orcamento.status })
      .from(orcamento)
      .where(eq(orcamento.osId, osId))
      .limit(1);
    return {
      orcamentoAprovado: orc?.status === "aprovado",
      cqAprovado: ordem.cqAprovado,
    };
  });
}
