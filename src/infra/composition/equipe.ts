import type { SessaoTenant } from "@/application/abrir-os";
import {
  type ConvidarMembroInput,
  type ConvidarMembroResult,
  convidarMembro,
  desativarMembro,
  listarEquipe,
  type MembroView,
  mudarCargo,
  reativarMembro,
} from "@/application/equipe";
import { createSupabaseAuthIdentity } from "@/infra/auth/supabase-identity";
import { database } from "@/infra/db/client";

/**
 * Composição da equipe (I1 — Fase de Implantação). Liga os casos de uso ao tenant corrente + ao
 * provedor de identidade real (Supabase). Server-only: usa a chave service_role para criar a
 * identidade do convidado. A camada web (`src/app`) importa daqui, nunca do `db`/`auth` direto.
 */

export type { MembroView };

function env(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variável de ambiente ${nome} não definida.`);
  }
  return valor;
}

function authIdentity() {
  return createSupabaseAuthIdentity(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

export function listarEquipeNoTenant(sessao: SessaoTenant): Promise<MembroView[]> {
  return listarEquipe(database, sessao);
}

export function convidarMembroNoTenant(
  sessao: SessaoTenant,
  input: ConvidarMembroInput,
): Promise<ConvidarMembroResult> {
  return convidarMembro({ database, auth: authIdentity() }, sessao, input);
}

export function mudarCargoNoTenant(
  sessao: SessaoTenant,
  membroId: string,
  cargoId: string,
): Promise<void> {
  return mudarCargo(database, sessao, membroId, cargoId);
}

export function desativarMembroNoTenant(sessao: SessaoTenant, membroId: string): Promise<void> {
  return desativarMembro(database, sessao, membroId);
}

export function reativarMembroNoTenant(sessao: SessaoTenant, membroId: string): Promise<void> {
  return reativarMembro(database, sessao, membroId);
}
