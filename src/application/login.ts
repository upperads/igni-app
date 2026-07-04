import type { AuthSignInPort } from "@/application/ports/auth-signin";
import { avaliarLockout, type PoliticaLockout } from "@/domain/auth/lockout";
import { exigeMfa } from "@/domain/auth/cargo";
import type { Papel } from "@/domain/auth/papel";
import { ContaBloqueadaError, CredenciaisInvalidasError } from "@/domain/shared/errors";
import type { AppDatabase } from "@/infra/db/connection";
import { resolverPerfilPorAuthUserId } from "@/infra/auth/perfil-repo";
import {
  falhasLoginDesde,
  limparTentativasLogin,
  registrarFalhaLogin,
} from "@/infra/auth/tentativas-repo";

export interface LoginInput {
  email: string;
  senha: string;
}

export interface LoginResult {
  authUserId: string;
  usuarioId: string;
  tenantId: string;
  papel: Papel;
  /** Se o usuário ainda precisa completar o 2FA (TOTP) para acessar (RNF-SEC-04). */
  mfaRequerido: boolean;
}

export interface LoginDeps {
  db: AppDatabase;
  auth: AuthSignInPort;
  politica: PoliticaLockout;
  /** Relógio injetável para testes determinísticos. */
  agora?: () => Date;
}

/**
 * US-02 — login com lockout e decisão de 2FA. Verifica o bloqueio antes de autenticar, conta as
 * falhas (RNF-SEC-05), e no sucesso reseta o contador, resolve tenant/papel e diz se o 2FA é
 * exigido. NÃO lida com sessão/cookies — isso fica na camada web (rota), que orquestra este caso
 * de uso. Roda na conexão privilegiada (pré-tenant).
 */
export async function login(deps: LoginDeps, input: LoginInput): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  const agora = deps.agora ? deps.agora() : new Date();
  const desde = new Date(agora.getTime() - deps.politica.janelaMs);

  // 1) Bloqueio antes de qualquer tentativa de autenticação.
  const falhas = await falhasLoginDesde(deps.db, email, desde);
  const avaliacao = avaliarLockout(falhas, deps.politica, agora);
  if (avaliacao.bloqueado && avaliacao.desbloqueioEm) {
    throw new ContaBloqueadaError(avaliacao.desbloqueioEm);
  }

  // 2) Verifica as credenciais.
  const signIn = await deps.auth.entrar({ email, senha: input.senha });
  if (!signIn) {
    await registrarFalhaLogin(deps.db, email, agora);
    const falhasDepois = await falhasLoginDesde(deps.db, email, desde);
    const avaliacaoDepois = avaliarLockout(falhasDepois, deps.politica, agora);
    if (avaliacaoDepois.bloqueado && avaliacaoDepois.desbloqueioEm) {
      throw new ContaBloqueadaError(avaliacaoDepois.desbloqueioEm);
    }
    throw new CredenciaisInvalidasError(avaliacaoDepois.tentativasRestantes);
  }

  // 3) Sucesso: reseta o contador e resolve o perfil da app.
  await limparTentativasLogin(deps.db, email);
  const perfil = await resolverPerfilPorAuthUserId(deps.db, signIn.authUserId);
  if (!perfil) {
    throw new Error("Identidade autenticada sem perfil de usuário correspondente.");
  }

  return {
    authUserId: signIn.authUserId,
    usuarioId: perfil.usuarioId,
    tenantId: perfil.tenantId,
    papel: perfil.papel,
    mfaRequerido:
      exigeMfa({ chao: false, exige2fa: perfil.exige2fa, permissoes: perfil.permissoes }) && !signIn.aal2,
  };
}
