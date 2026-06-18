import {
  criarOficina,
  type CriarOficinaInput,
  type CriarOficinaResult,
} from "@/application/criar-oficina";
import { createSupabaseAuthIdentity } from "@/infra/auth/supabase-identity";
import { db } from "@/infra/db/client";

/**
 * Raiz de composição da auth (camada de infra). Injeta o `db` privilegiado e os adaptadores reais
 * nos casos de uso, para a camada web (src/app) consumir SEM tocar no `db` direto (guarda do
 * review da US-01). Server-only: usa a chave service_role.
 */
function env(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variável de ambiente ${nome} não definida.`);
  }
  return valor;
}

export function registrarOficina(input: CriarOficinaInput): Promise<CriarOficinaResult> {
  const auth = createSupabaseAuthIdentity(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
  );
  return criarOficina({ db, auth }, input);
}
