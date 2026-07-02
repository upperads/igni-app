import { eq } from "drizzle-orm";
import {
  aprovarPorToken,
  recusarPorToken,
  resolverToken,
} from "@/application/portal";
import { aplicarPrioridade } from "@/application/triagem";
import { type EstadoOS, quatroPerguntas, rotuloEstado } from "@/domain/os/estado";
import {
  calcularOrcamento,
  type StatusOrcamento,
  type TipoItem,
  totalItem,
} from "@/domain/orcamento/orcamento";
import { database } from "@/infra/db/client";
import { cliente, entrada, equipamento, orcamento, orcamentoItem, os } from "@/infra/db/schema";
import { mascararChassi, mascararPlaca } from "@/infra/lgpd";
import { notificarPainel } from "@/infra/realtime/notificar";

/** De quem é a bola, na voz do cliente (CDC: estado/dependência, nunca isenção de culpa da oficina). */
export type Bola = "cliente" | "oficina";

export interface ItemPortal {
  tipo: TipoItem;
  descricao: string;
  totalCentavos: number;
}

export interface PortalView {
  numero: number;
  equipamento: string;
  placaMascarada: string | null;
  chassiMascarado: string | null;
  clienteNome: string;
  estado: EstadoOS;
  estadoRotulo: string;
  pergunta: { onde: string; oQueFalta: string; praOnde: string };
  bola: Bola;
  orcamento: { status: StatusOrcamento; itens: ItemPortal[]; total: number } | null;
  podeDecidir: boolean;
}

/** Leitura do portal (ADR-012): resolve o token, depois lê SÓ aquela OS via withTenant (RLS de volta). */
export async function dadosPortal(
  token: string,
  agora: Date = new Date(),
): Promise<PortalView | null> {
  const r = await resolverToken(database, token, agora);
  if (!r) {
    return null;
  }
  return database.withTenant(r.tenantId, async (tx) => {
    const [linha] = await tx
      .select({
        numero: os.numero,
        estado: os.estado,
        equipTipo: equipamento.tipo,
        placa: equipamento.placa,
        chassi: equipamento.chassi,
        clienteNome: cliente.nome,
      })
      .from(os)
      .innerJoin(equipamento, eq(equipamento.id, os.equipamentoId))
      .innerJoin(entrada, eq(entrada.id, os.entradaId))
      .innerJoin(cliente, eq(cliente.id, entrada.clienteId))
      .where(eq(os.id, r.osId))
      .limit(1);
    if (!linha) {
      return null;
    }

    const [orc] = await tx
      .select({ id: orcamento.id, status: orcamento.status })
      .from(orcamento)
      .where(eq(orcamento.id, r.orcamentoId))
      .limit(1);

    let orcamentoView: PortalView["orcamento"] = null;
    if (orc) {
      const itens = await tx
        .select({
          tipo: orcamentoItem.tipo,
          descricao: orcamentoItem.descricao,
          valorCentavos: orcamentoItem.valorCentavos,
          markupPct: orcamentoItem.markupPct,
        })
        .from(orcamentoItem)
        .where(eq(orcamentoItem.orcamentoId, orc.id))
        .orderBy(orcamentoItem.createdAt);
      orcamentoView = {
        status: orc.status,
        itens: itens.map((i) => ({
          tipo: i.tipo,
          descricao: i.descricao,
          totalCentavos: totalItem(i),
        })),
        total: calcularOrcamento(itens).total,
      };
    }

    const perguntas = quatroPerguntas(linha.estado);
    // A bola está com o cliente quando ele precisa decidir (aguardando aprovação).
    const bola: Bola = linha.estado === "aguardando_aprovacao" ? "cliente" : "oficina";

    return {
      numero: linha.numero,
      equipamento: linha.equipTipo,
      placaMascarada: mascararPlaca(linha.placa),
      chassiMascarado: mascararChassi(linha.chassi),
      clienteNome: linha.clienteNome,
      estado: linha.estado,
      estadoRotulo: rotuloEstado(linha.estado),
      pergunta: { onde: perguntas.onde, oQueFalta: perguntas.oQueFalta, praOnde: perguntas.praOnde },
      bola,
      orcamento: orcamentoView,
      podeDecidir: orc?.status === "enviado",
    };
  });
}

export interface ResultadoPortal {
  ok: boolean;
  motivo?: string;
}

export async function aprovarPortal(token: string, agora: Date = new Date()): Promise<ResultadoPortal> {
  const r = await aprovarPorToken(database, token, agora);
  if (r.ok && r.tenantId && r.osId) {
    await database.withTenant(r.tenantId, (tx) => aplicarPrioridade(tx, r.osId!, agora));
    await notificarPainel(r.tenantId);
  }
  return { ok: r.ok, motivo: r.motivo };
}

export async function recusarPortal(token: string, agora: Date = new Date()): Promise<ResultadoPortal> {
  const r = await recusarPorToken(database, token, agora);
  if (r.ok && r.tenantId && r.osId) {
    await database.withTenant(r.tenantId, (tx) => aplicarPrioridade(tx, r.osId!, agora));
    await notificarPainel(r.tenantId);
  }
  return { ok: r.ok, motivo: r.motivo };
}
