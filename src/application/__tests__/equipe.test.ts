import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SessaoTenant } from "@/application/abrir-os";
import { convidarMembro, mudarCargo } from "@/application/equipe";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { cargo, tenant, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";
import { FakeAuthIdentity } from "@/test/fake-auth";

/**
 * Equipe atribui CARGO (P-1): o convite liga o usuário ao cargo (2FA derivado do cargo) e a troca
 * de cargo respeita o Piso 1 (a oficina nunca fica sem Dono).
 */
describe("aplicação — equipe (cargo, P-1)", () => {
  let database: Database;
  let tenantId: string;
  let cargoDonoId: string;
  let cargoGestorId: string;
  let cargoProducaoId: string;
  let sessao: SessaoTenant;

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    await database.db.delete(usuario);
    await database.db.delete(cargo);
    await database.db.delete(tenant);

    const [t] = await database.db
      .insert(tenant)
      .values({ nome: "Oficina", templateRamo: "retifica_leve" })
      .returning();
    tenantId = t!.id;

    const [dono] = await database.db
      .insert(cargo)
      .values({ tenantId, nome: "Dono", sistema: true, chao: false, exige2fa: true, permissoes: ["equipe:gerir", "config:editar"] })
      .returning();
    const [gestor] = await database.db
      .insert(cargo)
      .values({ tenantId, nome: "Gestor", sistema: true, chao: false, exige2fa: true, permissoes: ["equipe:gerir", "config:editar"] })
      .returning();
    const [producao] = await database.db
      .insert(cargo)
      .values({ tenantId, nome: "Produção", sistema: true, chao: true, exige2fa: false, permissoes: ["os:avancar"] })
      .returning();
    cargoDonoId = dono!.id;
    cargoGestorId = gestor!.id;
    cargoProducaoId = producao!.id;

    const [admin] = await database.db
      .insert(usuario)
      .values({ tenantId, nome: "Dona", email: "dona@x.com", papel: "dono", cargoId: cargoDonoId })
      .returning();
    sessao = { tenantId, usuarioId: admin!.id };
  });

  describe("convidarMembro", () => {
    it("liga o novo membro ao cargoId informado e deriva o papel legado do nome do cargo", async () => {
      const r = await convidarMembro(
        { database, auth: new FakeAuthIdentity() },
        sessao,
        { nome: "Operador", email: "op@x.com", cargoId: cargoProducaoId, podeGerirCargos: false },
      );
      const [membro] = await database.db.select().from(usuario).where(eq(usuario.id, r.membroId));
      expect(membro?.cargoId).toBe(cargoProducaoId);
      expect(membro?.papel).toBe("producao");
    });

    it("cargo administrativo (Gestor) grava papel legado 'gestor'", async () => {
      const r = await convidarMembro(
        { database, auth: new FakeAuthIdentity() },
        sessao,
        { nome: "Gestor Novo", email: "gestor@x.com", cargoId: cargoGestorId, podeGerirCargos: false },
      );
      const [membro] = await database.db.select().from(usuario).where(eq(usuario.id, r.membroId));
      expect(membro?.papel).toBe("gestor");
    });

    it("rejeita cargoId que não existe (ou não pertence ao tenant)", async () => {
      await expect(
        convidarMembro(
          { database, auth: new FakeAuthIdentity() },
          sessao,
          { nome: "X", email: "x@x.com", cargoId: "00000000-0000-4000-8000-000000000000", podeGerirCargos: false },
        ),
      ).rejects.toBeInstanceOf(DadosInvalidosError);
    });

    it("REJEITA convidar para o cargo Dono se o chamador não pode gerir cargos", async () => {
      await expect(
        convidarMembro(
          { database, auth: new FakeAuthIdentity() },
          sessao,
          { nome: "Dono Intruso", email: "intruso@x.com", cargoId: cargoDonoId, podeGerirCargos: false },
        ),
      ).rejects.toThrow("Só o Dono pode nomear outro Dono.");
    });

    it("permite convidar para o cargo Dono se o chamador pode gerir cargos", async () => {
      const r = await convidarMembro(
        { database, auth: new FakeAuthIdentity() },
        sessao,
        { nome: "Dono Legítimo", email: "legitimo@x.com", cargoId: cargoDonoId, podeGerirCargos: true },
      );
      const [membro] = await database.db.select().from(usuario).where(eq(usuario.id, r.membroId));
      expect(membro?.cargoId).toBe(cargoDonoId);
      expect(membro?.papel).toBe("dono");
    });
  });

  describe("mudarCargo", () => {
    it("muda o cargo (e o papel legado deriva do novo cargo)", async () => {
      const convite = await convidarMembro(
        { database, auth: new FakeAuthIdentity() },
        sessao,
        { nome: "Operador", email: "op2@x.com", cargoId: cargoProducaoId, podeGerirCargos: false },
      );
      await mudarCargo(database, sessao, convite.membroId, cargoGestorId, true);
      const [membro] = await database.db.select().from(usuario).where(eq(usuario.id, convite.membroId));
      expect(membro?.cargoId).toBe(cargoGestorId);
      expect(membro?.papel).toBe("gestor");
    });

    it("NÃO permite mudar o próprio cargo", async () => {
      await expect(
        mudarCargo(database, sessao, sessao.usuarioId, cargoGestorId, true),
      ).rejects.toBeInstanceOf(DadosInvalidosError);
    });

    it("Piso 1: NÃO rebaixa o único Dono ativo", async () => {
      await expect(
        mudarCargo(database, sessao, sessao.usuarioId, cargoGestorId, true),
      ).rejects.toBeInstanceOf(DadosInvalidosError);
      // via outro usuário logado (não o próprio Dono) tentando rebaixar o único Dono:
      const outro = await convidarMembro(
        { database, auth: new FakeAuthIdentity() },
        sessao,
        { nome: "Gestor B", email: "gestorb@x.com", cargoId: cargoGestorId, podeGerirCargos: false },
      );
      const sessaoGestor: SessaoTenant = { tenantId, usuarioId: outro.membroId };
      await expect(
        mudarCargo(database, sessaoGestor, sessao.usuarioId, cargoProducaoId, false),
      ).rejects.toThrow("A oficina precisa de ao menos um Dono.");
    });

    it("permite rebaixar um Dono quando há outro Dono ativo", async () => {
      const segundoDono = await convidarMembro(
        { database, auth: new FakeAuthIdentity() },
        sessao,
        { nome: "Dono B", email: "donob@x.com", cargoId: cargoDonoId, podeGerirCargos: true },
      );
      await mudarCargo(database, sessao, segundoDono.membroId, cargoProducaoId, true);
      const [membro] = await database.db.select().from(usuario).where(eq(usuario.id, segundoDono.membroId));
      expect(membro?.cargoId).toBe(cargoProducaoId);
    });

    it("rejeita cargoId de destino inexistente", async () => {
      const convite = await convidarMembro(
        { database, auth: new FakeAuthIdentity() },
        sessao,
        { nome: "Operador", email: "op3@x.com", cargoId: cargoProducaoId, podeGerirCargos: false },
      );
      await expect(
        mudarCargo(database, sessao, convite.membroId, "00000000-0000-4000-8000-000000000000", true),
      ).rejects.toBeInstanceOf(DadosInvalidosError);
    });

    it("REJEITA promover alguém a Dono se o chamador não pode gerir cargos", async () => {
      const convite = await convidarMembro(
        { database, auth: new FakeAuthIdentity() },
        sessao,
        { nome: "Gestor C", email: "gestorc@x.com", cargoId: cargoGestorId, podeGerirCargos: false },
      );
      await expect(
        mudarCargo(database, sessao, convite.membroId, cargoDonoId, false),
      ).rejects.toThrow("Só o Dono pode nomear outro Dono.");
    });

    it("permite promover alguém a Dono se o chamador pode gerir cargos", async () => {
      const convite = await convidarMembro(
        { database, auth: new FakeAuthIdentity() },
        sessao,
        { nome: "Gestor D", email: "gestord@x.com", cargoId: cargoGestorId, podeGerirCargos: false },
      );
      await mudarCargo(database, sessao, convite.membroId, cargoDonoId, true);
      const [membro] = await database.db.select().from(usuario).where(eq(usuario.id, convite.membroId));
      expect(membro?.cargoId).toBe(cargoDonoId);
      expect(membro?.papel).toBe("dono");
    });
  });
});
