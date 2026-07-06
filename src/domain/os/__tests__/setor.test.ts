import { describe, expect, it } from "vitest";
import { validarSetor } from "@/domain/os/setor";
import { DadosInvalidosError } from "@/domain/shared/errors";

describe("setor — validarSetor", () => {
  it("rejeita nome vazio", () => {
    expect(() => validarSetor({ nome: "   " })).toThrow(DadosInvalidosError);
  });
  it("aceita nome válido", () => {
    expect(() => validarSetor({ nome: "Usinagem" })).not.toThrow();
  });
});
