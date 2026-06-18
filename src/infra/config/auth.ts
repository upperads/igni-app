import type { PoliticaLockout } from "@/domain/auth/lockout";

const DEFAULT_MAX_TENTATIVAS = 5;
const DEFAULT_JANELA_MS = 15 * 60 * 1000;

/**
 * Monta a política de lockout a partir do ambiente (RNF-SEC-05, configurável). `AUTH_MAX_LOGIN_ATTEMPTS`
 * controla N; valores ausentes ou inválidos caem no default seguro.
 */
export function politicaLockoutDoEnv(
  env: Record<string, string | undefined> = process.env,
): PoliticaLockout {
  const bruto = Number.parseInt(env.AUTH_MAX_LOGIN_ATTEMPTS ?? "", 10);
  const maxTentativas = Number.isInteger(bruto) && bruto > 0 ? bruto : DEFAULT_MAX_TENTATIVAS;
  return { maxTentativas, janelaMs: DEFAULT_JANELA_MS };
}
