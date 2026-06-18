import { describe, expect, it } from "vitest";
import { forcaSenha } from "@/domain/auth/forca-senha";

describe("forcaSenha", () => {
  it("classifica senha curta como muito fraca", () => {
    expect(forcaSenha("abc").nivel).toBe(0);
  });

  it("sobe o nível com tamanho e variedade de caracteres", () => {
    expect(forcaSenha("senhasenha").nivel).toBeGreaterThanOrEqual(1);
    expect(forcaSenha("Senha-Forte-2026!").nivel).toBe(4);
    expect(forcaSenha("Senha-Forte-2026!").rotulo).toBe("Forte");
  });

  it("nunca passa de 4", () => {
    expect(forcaSenha("A".repeat(40) + "aa11!!").nivel).toBe(4);
  });
});
