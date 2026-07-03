import { describe, expect, it } from "vitest";
import {
  aprovado,
  calcularOrcamento,
  type ItemOrcamento,
  podeDecidir,
  podeEditarItens,
  podeEnviar,
  podeReabrir,
  reaisParaCentavos,
  STATUS_ORCAMENTO,
  TIPOS_ITEM,
  totalItem,
} from "@/domain/orcamento/orcamento";
import { statusOrcamento, tipoItemOrcamento } from "@/infra/db/schema";

describe("orçamento — regras de status", () => {
  it("itens só no rascunho", () => {
    expect(podeEditarItens("rascunho")).toBe(true);
    expect(podeEditarItens("enviado")).toBe(false);
  });

  it("envia em rascunho com itens", () => {
    expect(podeEnviar("rascunho", 2)).toBe(true);
    expect(podeEnviar("rascunho", 0)).toBe(false);
    expect(podeEnviar("enviado", 2)).toBe(false);
  });

  it("decide (aprovar/recusar) só no enviado", () => {
    expect(podeDecidir("enviado")).toBe(true);
    expect(podeDecidir("rascunho")).toBe(false);
    expect(podeDecidir("aprovado")).toBe(false);
  });

  it("reabre quando recusado", () => {
    expect(podeReabrir("recusado")).toBe(true);
    expect(podeReabrir("enviado")).toBe(false);
  });

  it("aprovado libera o gate", () => {
    expect(aprovado("aprovado")).toBe(true);
    expect(aprovado("enviado")).toBe(false);
  });
});

describe("orçamento — totais (centavos, markup inteiro)", () => {
  it("total do item soma o markup", () => {
    expect(totalItem({ valorCentavos: 10_000, markupPct: 0 })).toBe(10_000);
    expect(totalItem({ valorCentavos: 10_000, markupPct: 30 })).toBe(13_000);
    // arredonda ao centavo
    expect(totalItem({ valorCentavos: 333, markupPct: 10 })).toBe(333 + 33);
  });

  it("reaisParaCentavos: aceita vírgula/ponto, rejeita formato inválido", () => {
    expect(reaisParaCentavos("150")).toBe(15_000);
    expect(reaisParaCentavos("150,50")).toBe(15_050);
    expect(reaisParaCentavos("150.50")).toBe(15_050);
    expect(reaisParaCentavos("  12,3 ")).toBe(1_230);
    expect(reaisParaCentavos("")).toBeNull();
    expect(reaisParaCentavos("abc")).toBeNull();
    expect(reaisParaCentavos("1,234")).toBeNull(); // 3 casas decimais
  });

  it("subtotais por tipo + total geral", () => {
    const itens: ItemOrcamento[] = [
      { tipo: "peca", valorCentavos: 50_000, markupPct: 0 },
      { tipo: "peca", valorCentavos: 20_000, markupPct: 0 },
      { tipo: "mao_de_obra", valorCentavos: 30_000, markupPct: 0 },
      { tipo: "terceiro", valorCentavos: 10_000, markupPct: 20 },
    ];
    const t = calcularOrcamento(itens);
    expect(t.porTipo.peca).toBe(70_000);
    expect(t.porTipo.mao_de_obra).toBe(30_000);
    expect(t.porTipo.terceiro).toBe(12_000);
    expect(t.total).toBe(112_000);
  });

  it("orçamento vazio zera", () => {
    const t = calcularOrcamento([]);
    expect(t.total).toBe(0);
    expect(t.porTipo).toEqual({ peca: 0, mao_de_obra: 0, terceiro: 0 });
  });
});

describe("orçamento — drift dos enums", () => {
  it("status_orcamento espelha STATUS_ORCAMENTO", () => {
    expect([...statusOrcamento.enumValues].sort()).toEqual([...STATUS_ORCAMENTO].sort());
  });
  it("tipo_item_orcamento espelha TIPOS_ITEM", () => {
    expect([...tipoItemOrcamento.enumValues].sort()).toEqual([...TIPOS_ITEM].sort());
  });
});
