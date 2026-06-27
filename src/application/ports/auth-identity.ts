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

export interface IdentidadeProvisoria {
  /** Id da identidade criada (vai para `usuario.auth_user_id`). */
  authUserId: string;
  /** Senha provisória gerada — entregue ao membro pelo dono. Não é persistida em lugar nenhum. */
  senhaProvisoria: string;
}

export interface AuthIdentityPort {
  /**
   * Cria a identidade no provedor e retorna seu id (vai para `usuario.auth_user_id`).
   * Deve lançar `EmailJaCadastradoError` (de `@/domain/shared/errors`) se o e-mail já existe.
   */
  criarIdentidade(input: CriarIdentidadeInput): Promise<string>;

  /**
   * Convite de equipe (I1): cria a identidade com uma SENHA PROVISÓRIA gerada pelo provedor e a
   * devolve para o dono entregar ao membro. O membro troca a senha no primeiro acesso. Deve lançar
   * `EmailJaCadastradoError` se o e-mail já existe. Não depende de SMTP (não envia e-mail).
   */
  criarComSenhaProvisoria(input: {
    email: string;
    appMetadata?: Record<string, unknown>;
  }): Promise<IdentidadeProvisoria>;

  /** Compensação (saga): remove uma identidade recém-criada se a persistência seguinte falhar. */
  removerIdentidade(authUserId: string): Promise<void>;
}
