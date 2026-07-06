import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/infra/db/connection";
import { setor, tenant } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

describe("isolamento multi-tenant — setor (RLS)", () => {
  let database: Database;
  let tenantA: string;
  let tenantB: string;

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });
  afterAll(async () => {
    await database.close();
  });
  beforeEach(async () => {
    await database.db.delete(setor);
    await database.db.delete(tenant);
    const [a] = await database.db.insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db.insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    tenantA = a!.id;
    tenantB = b!.id;
  });

  it("A enxerga apenas os próprios setores", async () => {
    await database.db.insert(setor).values({ tenantId: tenantA, nome: "Usinagem", ordem: 1 });
    await database.db.insert(setor).values({ tenantId: tenantB, nome: "Montagem", ordem: 1 });
    const vistos = await database.withTenant(tenantA, (tx) => tx.select().from(setor));
    expect(vistos).toHaveLength(1);
    expect(vistos[0]!.nome).toBe("Usinagem");
  });

  it("a RLS barra escrever setor de outro tenant (WITH CHECK)", async () => {
    await expect(
      database.withTenant(tenantA, (tx) => tx.insert(setor).values({ tenantId: tenantB, nome: "X", ordem: 1 })),
    ).rejects.toThrow();
  });
});
