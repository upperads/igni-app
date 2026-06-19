/**
 * Porta para o provedor de identidade/autenticação (ADR-006). A infra implementa com o Supabase
 * Auth; os testes usam um fake em memória. Mantém o caso de uso desacoplado do provedor.
 */

export interface CriarIdentidadeInput {
  email: string;
  senha: string;
  /** Metadados gravados no `app_metadata` (entram no JWT; ex.: papel, requires_mfa). */
  appMetadata?: Record<string, unknown>;
}

export interface AuthIdentityPort {
  /**
   * Cria a identidade no provedor e retorna seu id (vai para `usuario.auth_user_id`).
   * Deve lançar `EmailJaCadastradoError` (de `@/domain/shared/errors`) se o e-mail já existe.
   */
  criarIdentidade(input: CriarIdentidadeInput): Promise<string>;

  /** Compensação (saga): remove uma identidade recém-criada se a persistência seguinte falhar. */
  removerIdentidade(authUserId: string): Promise<void>;
}
