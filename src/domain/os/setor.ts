import { DadosInvalidosError } from "@/domain/shared/errors";

/** Valida um setor: nome não vazio. Lança DadosInvalidosError (padrão de validarCargo/validarTela). */
export function validarSetor(input: { nome: string }): void {
  if (!input.nome.trim()) {
    throw new DadosInvalidosError("Dê um nome ao setor.");
  }
}
