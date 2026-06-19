import { describe, expect, it } from "vitest";
import { FECHAMENTO, INTRO, PASSOS } from "@/app/primeiros-passos/conteudo";

describe("conteúdo dos Primeiros passos (US-17)", () => {
  it("tem introdução, seis passos numerados em ordem e fechamento, sem texto vazio", () => {
    expect(INTRO.length).toBeGreaterThan(0);
    expect(FECHAMENTO.length).toBeGreaterThan(0);
    expect(PASSOS).toHaveLength(6);

    PASSOS.forEach((passo, i) => {
      expect(passo.numero).toBe(i + 1);
      expect(passo.titulo.trim().length).toBeGreaterThan(0);
      expect(passo.paragrafos.length).toBeGreaterThan(0);
      for (const p of passo.paragrafos) {
        expect(p.trim().length).toBeGreaterThan(0);
      }
    });
  });

  it("mantém a voz anti-IA: sem travessão (—) na copy", () => {
    const tudo = [...INTRO, ...FECHAMENTO, ...PASSOS.flatMap((p) => p.paragrafos)].join(" ");
    expect(tudo).not.toContain("—");
  });
});
