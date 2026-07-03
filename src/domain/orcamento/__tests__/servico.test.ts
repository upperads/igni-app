import { describe, expect, it } from "vitest";
import { DadosInvalidosError } from "@/domain/shared/errors";
import {
  aplicarReajuste,
  pctReajusteValido,
  validarServico,
} from "@/domain/orcamento/servico";

describe("servico — validação", () => {
  it("aceita um serviço válido", () => {
    expect(() => validarServico({ nome: "Plaina", valorCentavos: 8000, markupPct: 0 })).not.toThrow();
  });
  it("rejeita nome vazio, valor negativo, markup negativo, não-inteiros", () => {
    expect(() => validarServico({ nome: "  ", valorCentavos: 8000, markupPct: 0 })).toThrow(DadosInvalidosError);
    expect(() => validarServico({ nome: "X", valorCentavos: -1, markupPct: 0 })).toThrow(DadosInvalidosError);
    expect(() => validarServico({ nome: "X", valorCentavos: 100, markupPct: -5 })).toThrow(DadosInvalidosError);
    expect(() => validarServico({ nome: "X", valorCentavos: 10.5, markupPct: 0 })).toThrow(DadosInvalidosError);
  });
});

describe("servico — reajuste em massa", () => {
  it("aplica +10% arredondando ao centavo", () => {
    expect(aplicarReajuste(10000, 10)).toBe(11000);
    expect(aplicarReajuste(999, 10)).toBe(1099); // 1098.9 → 1099
  });
  it("aceita desconto (pct negativo)", () => {
    expect(aplicarReajuste(10000, -20)).toBe(8000);
  });
  it("valida o intervalo do pct (-90 a +200)", () => {
    expect(pctReajusteValido(10)).toBe(true);
    expect(pctReajusteValido(-90)).toBe(true);
    expect(pctReajusteValido(200)).toBe(true);
    expect(pctReajusteValido(-91)).toBe(false);
    expect(pctReajusteValido(201)).toBe(false);
    expect(pctReajusteValido(1.5)).toBe(false); // só inteiro
  });
});
