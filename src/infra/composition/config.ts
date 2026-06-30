import {
  adicionarEstacao,
  type EstacaoView,
  listarEstacoes,
  removerEstacao,
  renomearEstacao,
  reordenarEstacoes,
} from "@/application/estacao";
import {
  type EstadoImplantacao,
  estadoImplantacao,
} from "@/application/implantacao";
import {
  limparDemonstracao,
  semearDemonstracao,
  type SeedResult,
  temDemonstracao,
} from "@/application/demonstracao";
import type { SessaoTenant } from "@/application/abrir-os";
import { database } from "@/infra/db/client";
import { notificarPainel } from "@/infra/realtime/notificar";

/**
 * Composição da Fase de Implantação (config da oficina): liga os casos de uso de ESTAÇÕES (I2) ao
 * tenant corrente. A camada web (`src/app`) importa daqui, nunca de `@/infra/db/client` (boundary
 * guard do ESLint). Equipe (I1) tem seu próprio módulo de composição.
 */

export type { EstacaoView, EstadoImplantacao };

export function estadoImplantacaoNoTenant(sessao: SessaoTenant): Promise<EstadoImplantacao> {
  return estadoImplantacao(database, sessao);
}

export function listarEstacoesNoTenant(sessao: SessaoTenant): Promise<EstacaoView[]> {
  return listarEstacoes(database, sessao);
}

export function adicionarEstacaoNoTenant(
  sessao: SessaoTenant,
  nome: string,
): Promise<EstacaoView> {
  return adicionarEstacao(database, sessao, nome);
}

export function renomearEstacaoNoTenant(
  sessao: SessaoTenant,
  estacaoId: string,
  nome: string,
): Promise<void> {
  return renomearEstacao(database, sessao, estacaoId, nome);
}

export function reordenarEstacoesNoTenant(
  sessao: SessaoTenant,
  idsNaOrdem: string[],
): Promise<void> {
  return reordenarEstacoes(database, sessao, idsNaOrdem);
}

export function removerEstacaoNoTenant(sessao: SessaoTenant, estacaoId: string): Promise<void> {
  return removerEstacao(database, sessao, estacaoId);
}

// --- Demonstração (I5) — preencher/limpar o cenário de venda, notificando o painel ao vivo ---

export function temDemonstracaoNoTenant(sessao: SessaoTenant): Promise<boolean> {
  return temDemonstracao(database, sessao);
}

export async function semearDemonstracaoNoTenant(sessao: SessaoTenant): Promise<SeedResult> {
  const r = await semearDemonstracao(database, sessao);
  await notificarPainel(sessao.tenantId);
  return r;
}

export async function limparDemonstracaoNoTenant(sessao: SessaoTenant): Promise<void> {
  await limparDemonstracao(database, sessao);
  await notificarPainel(sessao.tenantId);
}
