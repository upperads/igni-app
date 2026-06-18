/**
 * Porta de verificação de credenciais (ADR-006). Infra implementa com o Supabase Auth
 * (`signInWithPassword`); os testes usam um fake. Não lida com sessão/cookies — isso é da
 * camada web. Apenas confirma as credenciais e devolve a identidade.
 */

export interface SignInInput {
  email: string;
  senha: string;
}

export interface SignInResult {
  authUserId: string;
  /** Se a sessão já atingiu AAL2 (MFA verificado). Só com senha, é `false`. */
  aal2: boolean;
}

export interface AuthSignInPort {
  /** Verifica as credenciais. Retorna a identidade, ou `null` se forem inválidas. */
  entrar(input: SignInInput): Promise<SignInResult | null>;
}
