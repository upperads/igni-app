import type { SessaoTenant } from "@/application/abrir-os";
import {
  type CargoInput,
  type CargoView,
  contarUsuariosComCargoDono,
  criarCargo,
  editarCargo,
  excluirCargo,
  listarCargos,
  renomearCargo,
} from "@/application/cargo";
import { database } from "@/infra/db/client";

/** Composição dos cargos (P-1): liga os casos de uso ao tenant corrente. A web importa daqui. */
export type { CargoView, CargoInput };

export function listarCargosNoTenant(sessao: SessaoTenant): Promise<CargoView[]> {
  return listarCargos(database, sessao);
}
export function criarCargoNoTenant(sessao: SessaoTenant, input: CargoInput): Promise<{ id: string }> {
  return criarCargo(database, sessao, input);
}
export function editarCargoNoTenant(sessao: SessaoTenant, id: string, input: CargoInput): Promise<void> {
  return editarCargo(database, sessao, id, input);
}
export function renomearCargoNoTenant(sessao: SessaoTenant, id: string, nome: string): Promise<void> {
  return renomearCargo(database, sessao, id, nome);
}
export function excluirCargoNoTenant(sessao: SessaoTenant, id: string): Promise<void> {
  return excluirCargo(database, sessao, id);
}
export function contarDonosNoTenant(sessao: SessaoTenant): Promise<number> {
  return contarUsuariosComCargoDono(database, sessao);
}
