import { describe, expect, it } from "vitest";
import { templateRamo } from "@/infra/db/schema";
import { RAMOS, setoresDoRamo } from "../ramo";

describe("templates de ramo (setores→estações)", () => {
  it("o domínio cobre exatamente os valores do enum do banco (sem drift)", () => {
    expect([...RAMOS].sort()).toEqual([...templateRamo.enumValues].sort());
  });

  it("cada ramo tem setores com ordem única/positiva e ao menos 1 estação cada", () => {
    for (const ramo of RAMOS) {
      const setores = setoresDoRamo(ramo);
      expect(setores.length).toBeGreaterThan(0);
      const ordens = setores.map((s) => s.ordem);
      expect(new Set(ordens).size).toBe(ordens.length);
      expect(ordens.every((o) => o > 0)).toBe(true);
      for (const s of setores) {
        expect(s.nome.trim().length).toBeGreaterThan(0);
        expect(s.estacoes.length).toBeGreaterThan(0);
      }
    }
  });
});
