import { describe, expect, it } from "vitest";
import {
  exigeDescricao,
  MODALIDADES_ENTRADA,
  modalidadeValida,
  resolverDescricao,
} from "@/domain/os/entrada";
import { modalidadeEntrada } from "@/infra/db/schema/enums";

describe("entrada — modalidade", () => {
  it("o enum modalidade_entrada do banco espelha MODALIDADES_ENTRADA (sem drift)", () => {
    expect([...modalidadeEntrada.enumValues].sort()).toEqual([...MODALIDADES_ENTRADA].sort());
  });

  it("modalidadeValida só aceita os valores canônicos", () => {
    expect(modalidadeValida("patio_oficina")).toBe(true);
    expect(modalidadeValida("outra")).toBe(true);
    expect(modalidadeValida("inexistente")).toBe(false);
  });

  it("só 'outra' exige descrição", () => {
    expect(exigeDescricao("outra")).toBe(true);
    expect(exigeDescricao("patio_oficina")).toBe(false);
    expect(exigeDescricao("so_usinagem")).toBe(false);
  });

  it("resolverDescricao apara o texto de 'outra' e zera as demais", () => {
    expect(resolverDescricao("outra", "  Guincho parceiro  ")).toBe("Guincho parceiro");
    expect(resolverDescricao("patio_oficina", "ignorado")).toBeNull();
    expect(resolverDescricao("so_usinagem", null)).toBeNull();
  });

  it("'outra' sem texto lança (a action traduz em DadosInvalidos)", () => {
    expect(() => resolverDescricao("outra", "  ")).toThrow("DESCRICAO_OBRIGATORIA");
    expect(() => resolverDescricao("outra", null)).toThrow("DESCRICAO_OBRIGATORIA");
  });
});
