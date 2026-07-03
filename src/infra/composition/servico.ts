import type { SessaoTenant } from "@/application/abrir-os";
import {
  criarServico,
  desativarServico,
  editarServico,
  listarServicos,
  reajustarPrecos,
  reativarServico,
  type ServicoInput,
  type ServicoView,
} from "@/application/servico";
import { database } from "@/infra/db/client";

/** Composição do catálogo (P-2): liga os casos de uso ao tenant corrente. A web importa daqui. */

export type { ServicoView };

export function listarServicosNoTenant(
  sessao: SessaoTenant,
  opts?: { incluirInativos?: boolean },
): Promise<ServicoView[]> {
  return listarServicos(database, sessao, opts);
}

export function criarServicoNoTenant(sessao: SessaoTenant, input: ServicoInput): Promise<{ id: string }> {
  return criarServico(database, sessao, input);
}

export function editarServicoNoTenant(sessao: SessaoTenant, id: string, input: ServicoInput): Promise<void> {
  return editarServico(database, sessao, id, input);
}

export function desativarServicoNoTenant(sessao: SessaoTenant, id: string): Promise<void> {
  return desativarServico(database, sessao, id);
}

export function reativarServicoNoTenant(sessao: SessaoTenant, id: string): Promise<void> {
  return reativarServico(database, sessao, id);
}

export function reajustarPrecosNoTenant(
  sessao: SessaoTenant,
  pct: number,
): Promise<{ afetados: number }> {
  return reajustarPrecos(database, sessao, pct);
}
