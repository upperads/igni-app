import { describe, expect, it } from "vitest";
import { assertNever } from "./assert-never";

describe("assertNever", () => {
  it("lança com a mensagem padrão incluindo o valor recebido", () => {
    // cast deliberado: simula um valor fora da união em runtime
    expect(() => assertNever("inesperado" as never)).toThrowError(
      /Valor inesperado: inesperado/,
    );
  });

  it("usa a mensagem customizada quando fornecida", () => {
    expect(() => assertNever("x" as never, "Estado não tratado")).toThrowError(
      /Estado não tratado: x/,
    );
  });
});
