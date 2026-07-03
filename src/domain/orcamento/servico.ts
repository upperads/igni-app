import { DadosInvalidosError } from "@/domain/shared/errors";

/** Intervalo sensato do reajuste em massa — evita erro grosseiro (ex.: apagar preço com -100%). */
export const PCT_REAJUSTE_MIN = -90;
export const PCT_REAJUSTE_MAX = 200;

/** Valida os campos monetários/nome de um serviço do catálogo. Lança DadosInvalidosError. */
export function validarServico(input: { nome: string; valorCentavos: number; markupPct: number }): void {
  if (!input.nome.trim()) {
    throw new DadosInvalidosError("Dê um nome ao serviço.");
  }
  if (!Number.isInteger(input.valorCentavos) || input.valorCentavos < 0) {
    throw new DadosInvalidosError("Valor do serviço inválido.");
  }
  if (!Number.isInteger(input.markupPct) || input.markupPct < 0) {
    throw new DadosInvalidosError("Markup do serviço inválido.");
  }
}

/** Reajuste de um preço (centavos) em `pct` por cento, arredondado ao centavo. Aceita pct negativo. */
export function aplicarReajuste(centavos: number, pct: number): number {
  return Math.round((centavos * (100 + pct)) / 100);
}

/** Percentual de reajuste em massa aceito: inteiro dentro do intervalo. */
export function pctReajusteValido(pct: number): boolean {
  return Number.isInteger(pct) && pct >= PCT_REAJUSTE_MIN && pct <= PCT_REAJUSTE_MAX;
}
