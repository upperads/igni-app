import { DadosInvalidosError } from "@/domain/shared/errors";

/** Modos de uma tela (P-3/P-5a): mostra UMA estação, UM setor, ou a visão geral (tudo). Espelha o enum `modo_tela`. */
export const MODOS_TELA = ["estacao", "geral", "setor"] as const;
export type ModoTela = (typeof MODOS_TELA)[number];

/**
 * Invariante da tela: `estacao` exige uma estação; `setor` exige um setor; `geral` não tem nem
 * estação nem setor. Nome não vazio. Lança DadosInvalidosError — mesmo contrato de
 * validarCargo/validarServico.
 */
export function validarTela(input: {
  nome: string;
  modo: ModoTela;
  estacaoId: string | null;
  setorId: string | null;
}): void {
  if (!input.nome.trim()) {
    throw new DadosInvalidosError("Dê um nome à tela.");
  }
  if (input.modo === "estacao" && !input.estacaoId) {
    throw new DadosInvalidosError("Escolha a estação que esta tela mostra.");
  }
  if (input.modo === "setor" && !input.setorId) {
    throw new DadosInvalidosError("Escolha o setor que esta tela mostra.");
  }
  if (input.modo === "geral" && (input.estacaoId || input.setorId)) {
    throw new DadosInvalidosError("A visão geral não aponta para estação nem setor.");
  }
  // Coerência cruzada: só o campo do modo é preenchido.
  if (input.modo === "estacao" && input.setorId) {
    throw new DadosInvalidosError("Tela de estação não aponta para setor.");
  }
  if (input.modo === "setor" && input.estacaoId) {
    throw new DadosInvalidosError("Tela de setor não aponta para estação.");
  }
}
