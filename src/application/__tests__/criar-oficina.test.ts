import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarOficina, type CriarOficinaInput } from "@/application/criar-oficina";
import { CARGOS_SEMENTE } from "@/domain/auth/cargo";
import { DadosInvalidosError, EmailJaCadastradoError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { cargo, estacao, tenant, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";
import { FakeAuthIdentity } from "@/test/fake-auth";

function inputBase(over: Partial<CriarOficinaInput> = {}): CriarOficinaInput {
  return {
    nomeOficina: "Retífica Central",
    ramo: "retifica_leve",
    admin: { nome: "Maria", email: "maria@central.com", senha: "senha-forte-1" },
    ...over,
  };
}

describe("criarOficina (US-01)", () => {
  let database: Database;
  let auth: FakeAuthIdentity;

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
    await database.db.delete(estacao);
    await database.db.delete(tenant);
    auth = new FakeAuthIdentity();
  });

  it("cria tenant + admin (dono) + estações, ligando o admin à identidade e normalizando o e-mail", async () => {
    const res = await criarOficina(
      { db: database.db, auth },
      inputBase({ nomeOficina: "  Retífica Central  ", admin: { nome: "Maria", email: "  Maria@Central.com ", senha: "senha-forte-1" } }),
    );

    expect(res.estacoesCriadas).toBeGreaterThan(0);
    expect(res.authUserId).toBe(auth.criadas[0]);

    const [oficina] = await database.db.select().from(tenant).where(eq(tenant.id, res.tenantId));
    expect(oficina?.nome).toBe("Retífica Central");
    expect(oficina?.templateRamo).toBe("retifica_leve");

    const admins = await database.db.select().from(usuario).where(eq(usuario.tenantId, res.tenantId));
    expect(admins).toHaveLength(1);
    expect(admins[0]?.papel).toBe("dono");
    expect(admins[0]?.email).toBe("maria@central.com");
    expect(admins[0]?.authUserId).toBe(res.authUserId);

    const estacoes = await database.db.select().from(estacao).where(eq(estacao.tenantId, res.tenantId));
    expect(estacoes).toHaveLength(res.estacoesCriadas);
  });

  it("semeia os 7 cargos-semente do tenant novo e liga o admin ao cargo Dono (P-1)", async () => {
    const res = await criarOficina({ db: database.db, auth }, inputBase());

    const cargos = await database.db.select().from(cargo).where(eq(cargo.tenantId, res.tenantId));
    expect(cargos).toHaveLength(CARGOS_SEMENTE.length);
    expect(cargos.map((c) => c.nome).sort()).toEqual(CARGOS_SEMENTE.map((c) => c.nome).sort());

    const cargoDono = cargos.find((c) => c.nome === "Dono");
    expect(cargoDono).toBeTruthy();

    const [admin] = await database.db.select().from(usuario).where(eq(usuario.id, res.adminId));
    expect(admin?.cargoId).toBe(cargoDono!.id);
  });

  it("rejeita e-mail duplicado (no provedor) com erro de domínio e não cria a segunda oficina", async () => {
    await criarOficina({ db: database.db, auth }, inputBase({ admin: { nome: "Dono", email: "dup@x.com", senha: "senha-forte-1" } }));

    await expect(
      criarOficina({ db: database.db, auth }, inputBase({ nomeOficina: "Oficina B", admin: { nome: "Dono", email: "dup@x.com", senha: "senha-forte-1" } })),
    ).rejects.toBeInstanceOf(EmailJaCadastradoError);

    const tenants = await database.db.select().from(tenant);
    expect(tenants).toHaveLength(1);
  });

  it("compensa (remove a identidade órfã) se a persistência falhar", async () => {
    // Pré-insere um usuário com o e-mail direto no banco — a identidade no fake NÃO conhece esse
    // e-mail, então a criação da identidade passa, mas o INSERT no banco viola o unique → compensação.
    const [t] = await database.db
      .insert(tenant)
      .values({ nome: "Pré", templateRamo: "retifica_leve" })
      .returning({ id: tenant.id });
    await database.db
      .insert(usuario)
      .values({ tenantId: t!.id, nome: "Pré", email: "colide@x.com", papel: "dono" });

    await expect(
      criarOficina({ db: database.db, auth }, inputBase({ admin: { nome: "A", email: "colide@x.com", senha: "senha-forte-1" } })),
    ).rejects.toBeInstanceOf(EmailJaCadastradoError);

    expect(auth.criadas).toHaveLength(1);
    expect(auth.removidas).toEqual(auth.criadas); // a identidade criada foi removida
  });

  it("rejeita dados inválidos sem criar identidade (nome, e-mail e senha)", async () => {
    await expect(
      criarOficina({ db: database.db, auth }, inputBase({ nomeOficina: "   " })),
    ).rejects.toBeInstanceOf(DadosInvalidosError);

    await expect(
      criarOficina({ db: database.db, auth }, inputBase({ admin: { nome: "X", email: "sem-arroba", senha: "senha-forte-1" } })),
    ).rejects.toBeInstanceOf(DadosInvalidosError);

    await expect(
      criarOficina({ db: database.db, auth }, inputBase({ admin: { nome: "X", email: "ok@x.com", senha: "curta" } })),
    ).rejects.toBeInstanceOf(DadosInvalidosError);

    expect(auth.criadas).toHaveLength(0); // validação antes de tocar no provedor
  });
});
