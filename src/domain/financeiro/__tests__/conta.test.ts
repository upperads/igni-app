import { describe, expect, it } from "vitest";
import { FORMAS_PAGAMENTO, STATUS_CONTA, validarBaixa, validarTransicaoConta } from "@/domain/financeiro/conta";
import { DadosInvalidosError } from "@/domain/shared/errors";
import { formaPagamento, statusConta } from "@/infra/db/schema/enums";

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

  it("recebida → aberta é válida (desfazer); recebida → cancelada NÃO", () => {
    expect(() => validarTransicaoConta("recebida", "aberta")).not.toThrow();
    expect(() => validarTransicaoConta("recebida", "cancelada")).toThrow(DadosInvalidosError);
  });

  it("rejeita transições sem sentido", () => {
    expect(() => validarTransicaoConta("aberta", "aberta")).toThrow(DadosInvalidosError);
    expect(() => validarTransicaoConta("cancelada", "recebida")).toThrow(DadosInvalidosError);
  });

  it("o enum forma_pagamento do banco espelha FORMAS_PAGAMENTO (drift)", () => {
    expect([...FORMAS_PAGAMENTO].sort()).toEqual([...formaPagamento.enumValues].sort());
  });

  it("validarBaixa aceita forma do enum e rejeita fora dele", () => {
    expect(() => validarBaixa("pix")).not.toThrow();
    expect(() => validarBaixa("bitcoin")).toThrow(DadosInvalidosError);
  });
});
