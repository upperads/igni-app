import { DadosInvalidosError } from "@/domain/shared/errors";

/** Status da conta a receber (P-4a). Espelha o enum `status_conta` do banco (teste de drift). */
export const STATUS_CONTA = ["aberta", "recebida", "cancelada"] as const;
export type StatusConta = (typeof STATUS_CONTA)[number];

/**
 * Transições permitidas do dinheiro. `recebida→aberta` existe para o DESFAZER manual (P-4b) — mas o
 * congelamento automático (aprovarOrcamento não toca conta recebida) permanece; só a ação explícita reabre.
 */
const TRANSICOES: Record<StatusConta, readonly StatusConta[]> = {
  aberta: ["recebida", "cancelada"],
  cancelada: ["aberta"],
  recebida: ["aberta"],
};

/** Valida uma transição de status da conta. Lança DadosInvalidosError se inválida. */
export function validarTransicaoConta(de: StatusConta, para: StatusConta): void {
  if (!TRANSICOES[de].includes(para)) {
    throw new DadosInvalidosError(`Transição de conta inválida: ${de} → ${para}.`);
  }
}

/** Formas de pagamento aceitas na baixa (P-4b). Espelha o enum `forma_pagamento` do banco (drift). */
export const FORMAS_PAGAMENTO = ["dinheiro", "pix", "cartao_debito", "cartao_credito", "transferencia", "boleto"] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const ROTULO_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_debito: "Cartão de débito",
  cartao_credito: "Cartão de crédito",
  transferencia: "Transferência",
  boleto: "Boleto",
};

/** Valida a forma de pagamento da baixa. Lança DadosInvalidosError se não for do catálogo. */
export function validarBaixa(forma: string): void {
  if (!(FORMAS_PAGAMENTO as readonly string[]).includes(forma)) {
    throw new DadosInvalidosError("Forma de pagamento inválida.");
  }
}
