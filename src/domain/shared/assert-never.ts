/**
 * Garante exaustividade em `switch`/uniões discriminadas em tempo de compilação.
 * Se um novo estado/variante entra na união e algum ramo esquece de tratá-lo, o
 * TypeScript acusa o erro aqui. Em runtime, lança — defesa contra dados inválidos.
 * Será usado pela máquina de estados da OS (M2) e pela triagem (M3).
 */
export function assertNever(value: never, message = "Valor inesperado"): never {
  throw new Error(`${message}: ${String(value)}`);
}
