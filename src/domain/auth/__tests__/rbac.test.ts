import { describe, expect, it } from "vitest";
import { assertPode, pode } from "@/domain/auth/rbac";
import { AutorizacaoNegadaError } from "@/domain/shared/errors";

describe("RBAC (P-1 — sobre permissões do cargo)", () => {
  it("cargo sem a permissão não pode a ação", () => {
    expect(pode(["os:avancar"], "orcamento:editar")).toBe(false);
  });

  it("cargo com a permissão pode a ação", () => {
    expect(pode(["orcamento:editar"], "orcamento:editar")).toBe(true);
    expect(pode(["os:avancar"], "os:avancar")).toBe(true);
  });

  it("conjunto vazio não pode nenhuma ação administrativa", () => {
    expect(pode([], "equipe:gerir")).toBe(false);
    expect(pode([], "config:editar")).toBe(false);
  });

  it("assertPode não lança quando a permissão está presente", () => {
    expect(() => assertPode(["config:editar"], "config:editar")).not.toThrow();
  });

  it("assertPode lança AutorizacaoNegadaError quando a permissão está ausente", () => {
    expect(() => assertPode([], "config:editar")).toThrow(AutorizacaoNegadaError);
    expect(() => assertPode(["os:avancar"], "orcamento:editar")).toThrow(AutorizacaoNegadaError);
  });
});
