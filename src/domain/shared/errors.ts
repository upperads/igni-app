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
