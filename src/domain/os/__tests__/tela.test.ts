import { describe, expect, it } from "vitest";
import { modoTela } from "@/infra/db/schema/enums";
import { MODOS_TELA, validarTela } from "@/domain/os/tela";
import { DadosInvalidosError } from "@/domain/shared/errors";

describe("tela — domínio", () => {
  it("o enum do banco espelha MODOS_TELA (drift)", () => {
    expect([...MODOS_TELA].sort()).toEqual([...modoTela.enumValues].sort());
  });

  it("modo=estacao EXIGE estacao_id", () => {
    expect(() =>
      validarTela({ nome: "TV Bloco", modo: "estacao", estacaoId: null, setorId: null }),
    ).toThrow(DadosInvalidosError);
    expect(() =>
      validarTela({ nome: "TV Bloco", modo: "estacao", estacaoId: "abc", setorId: null }),
    ).not.toThrow();
  });

  it("modo=geral EXIGE estacao_id nulo", () => {
    expect(() =>
      validarTela({ nome: "Corredor", modo: "geral", estacaoId: "abc", setorId: null }),
    ).toThrow(DadosInvalidosError);
    expect(() =>
      validarTela({ nome: "Corredor", modo: "geral", estacaoId: null, setorId: null }),
    ).not.toThrow();
  });

  it("rejeita nome vazio", () => {
    expect(() =>
      validarTela({ nome: "   ", modo: "geral", estacaoId: null, setorId: null }),
    ).toThrow(DadosInvalidosError);
  });

  it("modo=setor EXIGE setor_id", () => {
    expect(() =>
      validarTela({ nome: "TV Usinagem", modo: "setor", estacaoId: null, setorId: null }),
    ).toThrow(DadosInvalidosError);
    expect(() =>
      validarTela({ nome: "TV Usinagem", modo: "setor", estacaoId: null, setorId: "xyz" }),
    ).not.toThrow();
  });

  it("modo=geral rejeita setor_id", () => {
    expect(() =>
      validarTela({ nome: "Corredor", modo: "geral", estacaoId: null, setorId: "xyz" }),
    ).toThrow(DadosInvalidosError);
  });

  it("coerência cruzada: estacao não aponta pra setor, setor não aponta pra estação", () => {
    expect(() =>
      validarTela({ nome: "X", modo: "estacao", estacaoId: "abc", setorId: "xyz" }),
    ).toThrow(DadosInvalidosError);
    expect(() =>
      validarTela({ nome: "X", modo: "setor", estacaoId: "abc", setorId: "xyz" }),
    ).toThrow(DadosInvalidosError);
  });
});
