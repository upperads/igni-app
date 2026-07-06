import type { SessaoTenant } from "@/application/abrir-os";
import {
  criarSetor,
  listarSetores,
  listarSetoresComEstacoes,
  moverEstacao,
  removerSetor,
  renomearSetor,
  reordenarSetores,
  type SetorComEstacoes,
  type SetorView,
} from "@/application/setor";
import { database } from "@/infra/db/client";

/** Composição dos setores (P-5a): liga os casos de uso ao tenant. A web importa daqui. */
export type { SetorView, SetorComEstacoes };

export function listarSetoresNoTenant(sessao: SessaoTenant): Promise<SetorView[]> {
  return listarSetores(database, sessao);
}
export function listarSetoresComEstacoesNoTenant(sessao: SessaoTenant): Promise<SetorComEstacoes[]> {
  return listarSetoresComEstacoes(database, sessao);
}
export function criarSetorNoTenant(sessao: SessaoTenant, nome: string): Promise<SetorView> {
  return criarSetor(database, sessao, nome);
}
export function renomearSetorNoTenant(sessao: SessaoTenant, id: string, nome: string): Promise<void> {
  return renomearSetor(database, sessao, id, nome);
}
export function reordenarSetoresNoTenant(sessao: SessaoTenant, ids: string[]): Promise<void> {
  return reordenarSetores(database, sessao, ids);
}
export function removerSetorNoTenant(sessao: SessaoTenant, id: string): Promise<void> {
  return removerSetor(database, sessao, id);
}
export function moverEstacaoNoTenant(sessao: SessaoTenant, estacaoId: string, setorId: string): Promise<void> {
  return moverEstacao(database, sessao, estacaoId, setorId);
}
