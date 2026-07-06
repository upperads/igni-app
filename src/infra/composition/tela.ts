import { eq } from "drizzle-orm";
import type { SessaoTenant } from "@/application/abrir-os";
import {
  configurarTela,
  listarTelas,
  registrarTela,
  resolverTelaPorToken,
  revogarTela,
  type TelaInput,
  type TelaResolvida,
  type TelaView,
} from "@/application/tela";
import { listarPainel } from "@/infra/composition/os";
import { database } from "@/infra/db/client";
import { estacao } from "@/infra/db/schema";

/** Composição das telas (P-3): liga os casos de uso ao tenant. A web importa daqui. */
export type { TelaView, TelaInput };

export function listarTelasNoTenant(sessao: SessaoTenant): Promise<TelaView[]> {
  return listarTelas(database, sessao);
}
export function registrarTelaNoTenant(
  sessao: SessaoTenant,
  input: TelaInput,
): Promise<{ token: string; codigoCurto: string }> {
  return registrarTela(database, sessao, input);
}
export function configurarTelaNoTenant(
  sessao: SessaoTenant,
  id: string,
  input: TelaInput,
): Promise<void> {
  return configurarTela(database, sessao, id, input);
}
export function revogarTelaNoTenant(sessao: SessaoTenant, id: string): Promise<void> {
  return revogarTela(database, sessao, id);
}

export interface DadosTv {
  tenantId: string;
  modo: TelaResolvida["modo"];
  estacaoId: string | null;
  /** Nome da estação, pro título da TV. Null em modo=geral ou se a estação não tem cards agora. */
  estacaoNome: string | null;
  /** Grupos já filtrados p/ renderizar: em modo=estacao, só a estação; em geral, todas as etapas. */
  etapas: Awaited<ReturnType<typeof listarPainel>>["etapas"];
  kpis: Awaited<ReturnType<typeof listarPainel>>["kpis"];
}

/**
 * Dados da rota pública /tv/[token]: resolve a tela (privilegiado), depois lê o painel no tenant DA
 * TELA (withTenant via {tenantId}). Null se token inválido/revogado → a rota mostra "desconectada".
 */
export async function dadosTv(tokenOuCodigo: string): Promise<DadosTv | null> {
  const resolvida = await resolverTelaPorToken(database, tokenOuCodigo);
  if (!resolvida) {
    return null;
  }
  const ctx: SessaoTenant = { tenantId: resolvida.tenantId, usuarioId: "" };
  const { kpis, etapas } = await listarPainel(ctx);
  if (resolvida.modo === "estacao" && resolvida.estacaoId) {
    // Só as OS da estação da tela: filtra os cards pelo estacaoId.
    const etapasFiltradas = etapas
      .map((e) => ({ ...e, cards: e.cards.filter((c) => c.estacaoId === resolvida.estacaoId) }))
      .filter((e) => e.cards.length > 0);
    // O nome da estação vem de um card já carregado (evita outra ida ao banco); pode ser null
    // se não há nenhuma OS ativa nessa estação agora — aceitável (título cai pro genérico na UI).
    const estacaoNome =
      etapasFiltradas.flatMap((e) => e.cards).find((c) => c.estacaoId === resolvida.estacaoId)?.estacaoNome ?? null;
    return {
      tenantId: resolvida.tenantId,
      modo: resolvida.modo,
      estacaoId: resolvida.estacaoId,
      estacaoNome,
      etapas: etapasFiltradas,
      kpis,
    };
  }
  if (resolvida.modo === "setor" && resolvida.setorId) {
    // Só as OS das estações do setor da tela: resolve as estações do setor e filtra os cards por elas.
    const estacoesDoSetor = await database.withTenant(resolvida.tenantId, (tx) =>
      tx.select({ id: estacao.id }).from(estacao).where(eq(estacao.setorId, resolvida.setorId!)),
    );
    const ids = new Set(estacoesDoSetor.map((e) => e.id));
    const etapasFiltradas = etapas
      .map((e) => ({ ...e, cards: e.cards.filter((c) => c.estacaoId && ids.has(c.estacaoId)) }))
      .filter((e) => e.cards.length > 0);
    return {
      tenantId: resolvida.tenantId,
      modo: resolvida.modo,
      estacaoId: null,
      estacaoNome: null,
      etapas: etapasFiltradas,
      kpis,
    };
  }
  return {
    tenantId: resolvida.tenantId,
    modo: resolvida.modo,
    estacaoId: null,
    estacaoNome: null,
    etapas,
    kpis,
  };
}
