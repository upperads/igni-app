import { describe, expect, it } from "vitest";
import { exigeMfa, PAPEIS } from "@/domain/auth/papel";
import { papelUsuario } from "@/infra/db/schema";

describe("papel / 2FA", () => {
  it("cobre exatamente os valores do enum do banco (sem drift)", () => {
    expect([...PAPEIS].sort()).toEqual([...papelUsuario.enumValues].sort());
  });

  it("exige MFA para papéis administrativos (dono, gestor)", () => {
    expect(exigeMfa("dono")).toBe(true);
    expect(exigeMfa("gestor")).toBe(true);
  });

  it("não exige MFA para papéis operacionais (recepcao, producao)", () => {
    expect(exigeMfa("recepcao")).toBe(false);
    expect(exigeMfa("producao")).toBe(false);
  });
});
