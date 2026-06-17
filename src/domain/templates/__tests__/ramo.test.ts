import { describe, expect, it } from "vitest";
import { templateRamo } from "@/infra/db/schema";
import { estacoesDoRamo, RAMOS } from "../ramo";

describe("templates de ramo", () => {
  it("o domínio cobre exatamente os valores do enum do banco (sem drift)", () => {
    expect([...RAMOS].sort()).toEqual([...templateRamo.enumValues].sort());
  });

  it("cada ramo pré-carrega estações com ordem única e positiva", () => {
    for (const ramo of RAMOS) {
      const estacoes = estacoesDoRamo(ramo);
      expect(estacoes.length).toBeGreaterThan(0);

      const ordens = estacoes.map((e) => e.ordem);
      expect(new Set(ordens).size).toBe(ordens.length);
      expect(ordens.every((o) => o > 0)).toBe(true);
    }
  });
});
