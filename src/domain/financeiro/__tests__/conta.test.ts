import { describe, expect, it } from "vitest";
import { STATUS_CONTA, validarTransicaoConta } from "@/domain/financeiro/conta";
import { DadosInvalidosError } from "@/domain/shared/errors";
import { statusConta } from "@/infra/db/schema/enums";

describe("financeiro — conta (máquina de estados do dinheiro)", () => {
  it("o enum do banco espelha STATUS_CONTA (drift)", () => {
    expect([...STATUS_CONTA].sort()).toEqual([...statusConta.enumValues].sort());
  });

  it("aberta → recebida | cancelada", () => {
    expect(() => validarTransicaoConta("aberta", "recebida")).not.toThrow();
    expect(() => validarTransicaoConta("aberta", "cancelada")).not.toThrow();
  });

  it("cancelada → aberta (reaprovação)", () => {
    expect(() => validarTransicaoConta("cancelada", "aberta")).not.toThrow();
  });

  it("recebida é terminal (rejeita qualquer transição)", () => {
    expect(() => validarTransicaoConta("recebida", "aberta")).toThrow(DadosInvalidosError);
    expect(() => validarTransicaoConta("recebida", "cancelada")).toThrow(DadosInvalidosError);
  });

  it("rejeita transições sem sentido", () => {
    expect(() => validarTransicaoConta("aberta", "aberta")).toThrow(DadosInvalidosError);
    expect(() => validarTransicaoConta("cancelada", "recebida")).toThrow(DadosInvalidosError);
  });
});
