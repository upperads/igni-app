import { DadosInvalidosError } from "@/domain/shared/errors";

/** Modos de uma tela (P-3): mostra UMA estação, ou a visão geral (tudo). Espelha o enum `modo_tela`. */
export const MODOS_TELA = ["estacao", "geral"] as const;
export type ModoTela = (typeof MODOS_TELA)[number];

/**
 * Invariante da tela: `estacao` exige uma estação; `geral` não tem estação. Nome não vazio.
 * Lança DadosInvalidosError — mesmo contrato de validarCargo/validarServico.
 */
export function validarTela(input: { nome: string; modo: ModoTela; estacaoId: string | null }): void {
  if (!input.nome.trim()) {
    throw new DadosInvalidosError("Dê um nome à tela.");
  }
  if (input.modo === "estacao" && !input.estacaoId) {
    throw new DadosInvalidosError("Escolha a estação que esta tela mostra.");
  }
  if (input.modo === "geral" && input.estacaoId) {
    throw new DadosInvalidosError("A visão geral não aponta para uma estação.");
  }
}
