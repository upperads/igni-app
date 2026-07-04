import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { login, type LoginDeps } from "@/application/login";
import type { PoliticaLockout } from "@/domain/auth/lockout";
import { ContaBloqueadaError, CredenciaisInvalidasError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { cargo, tenant, tentativaLogin, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";
import { FakeAuthSignIn } from "@/test/fake-signin";

const POLITICA: PoliticaLockout = { maxTentativas: 3, janelaMs: 15 * 60 * 1000 };
const AUTH_ID_ADMIN = "11111111-1111-4111-8111-111111111111";
const AUTH_ID_OP = "22222222-2222-4222-8222-222222222222";

describe("login (US-02)", () => {
  let database: Database;
  let auth: FakeAuthSignIn;
  let clock: Date;

  function deps(): LoginDeps {
    return { db: database.db, auth, politica: POLITICA, agora: () => clock };
  }

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    await database.db.delete(tentativaLogin);
    await database.db.delete(usuario);
    await database.db.delete(cargo);
    await database.db.delete(tenant);

    const [t] = await database.db
      .insert(tenant)
      .values({ nome: "Oficina", templateRamo: "retifica_leve" })
      .returning({ id: tenant.id });

    // Cargo Dono: exige 2FA (piso). Cargo Produção: não exige.
    const [cargoDono] = await database.db
      .insert(cargo)
      .values({
        tenantId: t!.id,
        nome: "Dono",
        sistema: true,
        chao: false,
        exige2fa: true,
        permissoes: ["equipe:gerir", "config:editar"],
      })
      .returning({ id: cargo.id });
    const [cargoProducao] = await database.db
      .insert(cargo)
      .values({
        tenantId: t!.id,
        nome: "Produção",
        sistema: true,
        chao: true,
        exige2fa: false,
        permissoes: ["os:avancar"],
      })
      .returning({ id: cargo.id });

    await database.db.insert(usuario).values({
      tenantId: t!.id,
      authUserId: AUTH_ID_ADMIN,
      nome: "Dona",
      email: "dona@x.com",
      papel: "dono",
      cargoId: cargoDono!.id,
    });
    await database.db.insert(usuario).values({
      tenantId: t!.id,
      authUserId: AUTH_ID_OP,
      nome: "Operador",
      email: "op@x.com",
      papel: "producao",
      cargoId: cargoProducao!.id,
    });

    auth = new FakeAuthSignIn();
    auth.registrar("dona@x.com", "senha-correta", AUTH_ID_ADMIN);
    auth.registrar("op@x.com", "senha-correta", AUTH_ID_OP);
    clock = new Date("2026-06-17T12:00:00.000Z");
  });

  it("login válido de admin resolve tenant/papel e exige MFA", async () => {
    const r = await login(deps(), { email: "Dona@X.com", senha: "senha-correta" });
    expect(r.papel).toBe("dono");
    expect(r.tenantId).toBeTruthy();
    expect(r.mfaRequerido).toBe(true);
  });

  it("papel operacional não exige MFA", async () => {
    const r = await login(deps(), { email: "op@x.com", senha: "senha-correta" });
    expect(r.papel).toBe("producao");
    expect(r.mfaRequerido).toBe(false);
  });

  it("senha inválida conta como falha e bloqueia ao atingir o limite", async () => {
    await expect(login(deps(), { email: "dona@x.com", senha: "errada" })).rejects.toBeInstanceOf(CredenciaisInvalidasError);
    await expect(login(deps(), { email: "dona@x.com", senha: "errada" })).rejects.toBeInstanceOf(CredenciaisInvalidasError);
    // 3ª falha atinge N=3 → bloqueia
    await expect(login(deps(), { email: "dona@x.com", senha: "errada" })).rejects.toBeInstanceOf(ContaBloqueadaError);
    // mesmo com a senha certa, segue bloqueado dentro da janela
    await expect(login(deps(), { email: "dona@x.com", senha: "senha-correta" })).rejects.toBeInstanceOf(ContaBloqueadaError);
  });

  it("depois que a janela passa, a conta volta a poder logar", async () => {
    for (let i = 0; i < 3; i += 1) {
      await login(deps(), { email: "dona@x.com", senha: "errada" }).catch(() => undefined);
    }
    clock = new Date(clock.getTime() + POLITICA.janelaMs + 1000);
    const r = await login(deps(), { email: "dona@x.com", senha: "senha-correta" });
    expect(r.papel).toBe("dono");
  });

  it("login bem-sucedido reseta o contador de tentativas", async () => {
    await login(deps(), { email: "dona@x.com", senha: "errada" }).catch(() => undefined);
    await login(deps(), { email: "dona@x.com", senha: "errada" }).catch(() => undefined);
    await login(deps(), { email: "dona@x.com", senha: "senha-correta" });

    const err = await login(deps(), { email: "dona@x.com", senha: "errada" }).catch((e) => e);
    expect(err).toBeInstanceOf(CredenciaisInvalidasError);
    expect((err as CredenciaisInvalidasError).tentativasRestantes).toBe(2);
  });
});
