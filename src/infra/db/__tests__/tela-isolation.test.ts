import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/infra/db/connection";
import { tela, tenant } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

/** Isolamento RLS da tabela tela (regra de ouro #7): A nunca vê/toca as telas de B. */
describe("isolamento multi-tenant — tela (RLS)", () => {
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
    await database.db.delete(tela);
    await database.db.delete(tenant);
    const [a] = await database.db.insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db.insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    tenantA = a!.id;
    tenantB = b!.id;
  });

  it("A enxerga apenas as próprias telas", async () => {
    await database.db.insert(tela).values({ tenantId: tenantA, nome: "TV A", modo: "geral", tokenHash: "h-a", codigoCurto: "AAA1" });
    await database.db.insert(tela).values({ tenantId: tenantB, nome: "TV B", modo: "geral", tokenHash: "h-b", codigoCurto: "BBB1" });

    const vistos = await database.withTenant(tenantA, (tx) => tx.select().from(tela));
    expect(vistos).toHaveLength(1);
    expect(vistos[0]!.nome).toBe("TV A");

    const deB = await database.withTenant(tenantA, (tx) => tx.select().from(tela).where(eq(tela.nome, "TV B")));
    expect(deB).toHaveLength(0);
  });

  it("a RLS barra ESCREVER uma tela marcada como de outro tenant (WITH CHECK)", async () => {
    await expect(
      database.withTenant(tenantA, (tx) =>
        tx.insert(tela).values({ tenantId: tenantB, nome: "Intrusa", modo: "geral", tokenHash: "h-x", codigoCurto: "XXX1" }),
      ),
    ).rejects.toThrow();
  });
});
