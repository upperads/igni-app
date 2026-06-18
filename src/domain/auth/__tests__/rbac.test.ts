import { describe, expect, it } from "vitest";
import { assertPode, pode } from "@/domain/auth/rbac";
import { AutorizacaoNegadaError } from "@/domain/shared/errors";

describe("RBAC (US-03)", () => {
  it("produção NÃO edita orçamento", () => {
    expect(pode("producao", "orcamento:editar")).toBe(false);
  });

  it("recepção, gestor e dono editam orçamento", () => {
    expect(pode("recepcao", "orcamento:editar")).toBe(true);
    expect(pode("gestor", "orcamento:editar")).toBe(true);
    expect(pode("dono", "orcamento:editar")).toBe(true);
  });

  it("produção avança etapa pelo bump", () => {
    expect(pode("producao", "os:avancar")).toBe(true);
  });

  it("apenas o tier admin (dono/gestor) gerencia usuários e configuração", () => {
    for (const acao of ["usuario:gerenciar", "config:editar"] as const) {
      expect(pode("dono", acao)).toBe(true);
      expect(pode("gestor", acao)).toBe(true);
      expect(pode("recepcao", acao)).toBe(false);
      expect(pode("producao", acao)).toBe(false);
    }
  });

  it("assertPode lança quando negado e passa quando permitido", () => {
    expect(() => assertPode("producao", "orcamento:editar")).toThrow(AutorizacaoNegadaError);
    expect(() => assertPode("recepcao", "orcamento:editar")).not.toThrow();
  });
});
