import { describe, expect, it } from "vitest";
import { ALFABETO_CODIGO, gerarCodigoCurto } from "@/domain/os/quiosque";

describe("quiosque — código curto de backup", () => {
  it("monta PREFIXO-SUFIXO em maiúsculas, prefixo do nome do setor", () => {
    expect(gerarCodigoCurto("Bloco", "4K2P")).toBe("BLOCO-4K2P");
  });
  it("corta prefixo longo e tira não-letras", () => {
    expect(gerarCodigoCurto("Controle de Qualidade", "7X9Z")).toBe("CONTR-7X9Z");
  });
  it("prefixo vazio vira 'SETOR'", () => {
    expect(gerarCodigoCurto("   ", "1A2B")).toBe("SETOR-1A2B");
  });
  it("o alfabeto não tem caracteres ambíguos (0/O/1/I)", () => {
    expect(ALFABETO_CODIGO).not.toMatch(/[01OI]/);
  });
});
