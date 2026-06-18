import type { SupabaseClient } from "@supabase/supabase-js";
import {
  criarOficina,
  type CriarOficinaInput,
  type CriarOficinaResult,
} from "@/application/criar-oficina";
import { login, type LoginInput, type LoginResult } from "@/application/login";
import { createSupabaseAuthIdentity } from "@/infra/auth/supabase-identity";
import { createSupabaseSignIn } from "@/infra/auth/supabase-signin";
import { politicaLockoutDoEnv } from "@/infra/config/auth";
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

/**
 * Login: recebe o `SupabaseClient` da rota (com cookies de sessão) e roda o caso de uso `login`
 * com o db privilegiado + a política de lockout do ambiente. O `signInWithPassword` por dentro
 * estabelece a sessão nos cookies.
 */
export function autenticar(supabase: SupabaseClient, input: LoginInput): Promise<LoginResult> {
  return login(
    { db, auth: createSupabaseSignIn(supabase), politica: politicaLockoutDoEnv() },
    input,
  );
}
