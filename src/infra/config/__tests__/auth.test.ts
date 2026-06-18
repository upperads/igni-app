import { describe, expect, it } from "vitest";
import { politicaLockoutDoEnv } from "@/infra/config/auth";

describe("politicaLockoutDoEnv", () => {
  it("cai no default seguro quando a env está ausente ou inválida", () => {
    expect(politicaLockoutDoEnv({}).maxTentativas).toBe(5);
    expect(politicaLockoutDoEnv({ AUTH_MAX_LOGIN_ATTEMPTS: "abc" }).maxTentativas).toBe(5);
    expect(politicaLockoutDoEnv({ AUTH_MAX_LOGIN_ATTEMPTS: "0" }).maxTentativas).toBe(5);
  });

  it("usa o valor configurado quando é um inteiro positivo", () => {
    expect(politicaLockoutDoEnv({ AUTH_MAX_LOGIN_ATTEMPTS: "3" }).maxTentativas).toBe(3);
  });
});
