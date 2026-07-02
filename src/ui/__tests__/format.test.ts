import { describe, expect, it } from "vitest";
import { data, moeda, telefone } from "@/ui/format";

describe("format — moeda (centavos → R$)", () => {
  it("formata centavos como reais pt-BR", () => {
    expect(moeda(123_456)).toBe("R$ 1.234,56");
    expect(moeda(0)).toBe("R$ 0,00");
    expect(moeda(50)).toBe("R$ 0,50");
  });
});

describe("format — telefone (normalizado → exibição)", () => {
  it("celular com DDI 55 → (DD) 9XXXX-XXXX", () => {
    expect(telefone("5511999990001")).toBe("(11) 99999-0001");
  });

  it("celular sem DDI (11 dígitos) também formata", () => {
    expect(telefone("11999990001")).toBe("(11) 99999-0001");
  });

  it("fixo (10 dígitos) → (DD) XXXX-XXXX", () => {
    expect(telefone("1133334444")).toBe("(11) 3333-4444");
  });

  it("vazio/nulo → string vazia (não quebra a UI)", () => {
    expect(telefone(null)).toBe("");
    expect(telefone(undefined)).toBe("");
    expect(telefone("")).toBe("");
  });

  it("formato inesperado → mostra os dígitos, sem quebrar", () => {
    expect(telefone("12345")).toBe("12345");
  });
});

describe("format — data (pt-BR)", () => {
  it("data → dd/mm/aaaa", () => {
    // Meio-dia UTC evita virar o dia por fuso na maioria dos ambientes.
    expect(data("2026-06-30T12:00:00Z")).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});
