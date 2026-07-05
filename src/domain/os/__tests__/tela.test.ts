import { describe, expect, it } from "vitest";
import { modoTela } from "@/infra/db/schema/enums";
import { MODOS_TELA, validarTela } from "@/domain/os/tela";
import { DadosInvalidosError } from "@/domain/shared/errors";

describe("tela — domínio", () => {
  it("o enum do banco espelha MODOS_TELA (drift)", () => {
    expect([...MODOS_TELA].sort()).toEqual([...modoTela.enumValues].sort());
  });

  it("modo=estacao EXIGE estacao_id", () => {
    expect(() => validarTela({ nome: "TV Bloco", modo: "estacao", estacaoId: null })).toThrow(DadosInvalidosError);
    expect(() => validarTela({ nome: "TV Bloco", modo: "estacao", estacaoId: "abc" })).not.toThrow();
  });

  it("modo=geral EXIGE estacao_id nulo", () => {
    expect(() => validarTela({ nome: "Corredor", modo: "geral", estacaoId: "abc" })).toThrow(DadosInvalidosError);
    expect(() => validarTela({ nome: "Corredor", modo: "geral", estacaoId: null })).not.toThrow();
  });

  it("rejeita nome vazio", () => {
    expect(() => validarTela({ nome: "   ", modo: "geral", estacaoId: null })).toThrow(DadosInvalidosError);
  });
});
