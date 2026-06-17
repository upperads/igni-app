import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarOficina, type CriarOficinaInput } from "@/application/criar-oficina";
import { DadosInvalidosError, EmailJaCadastradoError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { estacao, tenant, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

describe("criarOficina (US-01)", () => {
  let database: Database;

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    await database.db.delete(usuario);
    await database.db.delete(estacao);
    await database.db.delete(tenant);
  });

  it("cria tenant + admin (dono) + estações do template, normalizando o e-mail", async () => {
    const res = await criarOficina(database.db, {
      nomeOficina: "  Retífica Central  ",
      ramo: "retifica_leve",
      admin: { nome: "Maria", email: "  Maria@Central.com " },
    });

    expect(res.tenantId).toBeTruthy();
    expect(res.estacoesCriadas).toBeGreaterThan(0);

    const [oficina] = await database.db.select().from(tenant).where(eq(tenant.id, res.tenantId));
    expect(oficina?.nome).toBe("Retífica Central");
    expect(oficina?.templateRamo).toBe("retifica_leve");

    const admins = await database.db
      .select()
      .from(usuario)
      .where(eq(usuario.tenantId, res.tenantId));
    expect(admins).toHaveLength(1);
    expect(admins[0]?.papel).toBe("dono");
    expect(admins[0]?.email).toBe("maria@central.com");

    const estacoes = await database.db
      .select()
      .from(estacao)
      .where(eq(estacao.tenantId, res.tenantId));
    expect(estacoes).toHaveLength(res.estacoesCriadas);
  });

  it("rejeita e-mail duplicado com erro de domínio e não cria a segunda oficina", async () => {
    const input: CriarOficinaInput = {
      nomeOficina: "Oficina A",
      ramo: "retifica_leve",
      admin: { nome: "Dono", email: "dup@x.com" },
    };
    await criarOficina(database.db, input);

    await expect(
      criarOficina(database.db, { ...input, nomeOficina: "Oficina B" }),
    ).rejects.toBeInstanceOf(EmailJaCadastradoError);

    const tenants = await database.db.select().from(tenant);
    expect(tenants).toHaveLength(1);
    expect(tenants[0]?.nome).toBe("Oficina A");
  });

  it("rejeita dados obrigatórios vazios", async () => {
    await expect(
      criarOficina(database.db, {
        nomeOficina: "   ",
        ramo: "retifica_leve",
        admin: { nome: "X", email: "x@x.com" },
      }),
    ).rejects.toBeInstanceOf(DadosInvalidosError);

    await expect(
      criarOficina(database.db, {
        nomeOficina: "Ok",
        ramo: "retifica_leve",
        admin: { nome: "X", email: "sem-arroba" },
      }),
    ).rejects.toBeInstanceOf(DadosInvalidosError);
  });
});
