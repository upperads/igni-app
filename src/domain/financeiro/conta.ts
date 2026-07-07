import { DadosInvalidosError } from "@/domain/shared/errors";

/** Status da conta a receber (P-4a). Espelha o enum `status_conta` do banco (teste de drift). */
export const STATUS_CONTA = ["aberta", "recebida", "cancelada"] as const;
export type StatusConta = (typeof STATUS_CONTA)[number];

/** Transições permitidas do dinheiro. `recebida` é terminal (congela). */
const TRANSICOES: Record<StatusConta, readonly StatusConta[]> = {
  aberta: ["recebida", "cancelada"],
  cancelada: ["aberta"],
  recebida: [],
};

/** Valida uma transição de status da conta. Lança DadosInvalidosError se inválida. */
export function validarTransicaoConta(de: StatusConta, para: StatusConta): void {
  if (!TRANSICOES[de].includes(para)) {
    throw new DadosInvalidosError(`Transição de conta inválida: ${de} → ${para}.`);
  }
}
