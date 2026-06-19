/** Erros de domínio: casos de uso lançam estes; a camada web traduz em mensagem/HTTP. */

export class DadosInvalidosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DadosInvalidosError";
  }
}

export class EmailJaCadastradoError extends Error {
  constructor(public readonly email: string) {
    super(`E-mail já cadastrado: ${email}`);
    this.name = "EmailJaCadastradoError";
  }
}

/** Contexto de tenant ausente/ inválido ao abrir uma transação escopada (ADR-005). */
export class TenantContextoInvalidoError extends Error {
  constructor(public readonly tenantId: string) {
    super("Contexto de tenant inválido: identificador não é um UUID.");
    this.name = "TenantContextoInvalidoError";
  }
}

/** Credenciais de login inválidas (e-mail/senha). Mensagem genérica de propósito (não revela qual). */
export class CredenciaisInvalidasError extends Error {
  constructor(public readonly tentativasRestantes: number) {
    super("E-mail ou senha inválidos.");
    this.name = "CredenciaisInvalidasError";
  }
}

/** Conta bloqueada por exceder o limite de tentativas (RNF-SEC-05). */
export class ContaBloqueadaError extends Error {
  constructor(public readonly desbloqueioEm: Date) {
    super("Conta temporariamente bloqueada por excesso de tentativas. Tente novamente mais tarde.");
    this.name = "ContaBloqueadaError";
  }
}

/** Papel sem permissão para a ação solicitada (RBAC, RNF-SEC-02 / US-03). */
export class AutorizacaoNegadaError extends Error {
  constructor(
    public readonly papel: string,
    public readonly acao: string,
  ) {
    super(`Permissão negada: o papel '${papel}' não pode '${acao}'.`);
    this.name = "AutorizacaoNegadaError";
  }
}

/** OS não encontrada no tenant corrente (M2). */
export class OsNaoEncontradaError extends Error {
  constructor(public readonly osId: string) {
    super("Ordem de serviço não encontrada.");
    this.name = "OsNaoEncontradaError";
  }
}
