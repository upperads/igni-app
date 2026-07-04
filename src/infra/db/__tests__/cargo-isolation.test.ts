import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/infra/db/connection";
import { cargo, tenant } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

/** Isolamento RLS da tabela cargo (regra de ouro #7): A nunca vê/toca os cargos de B. */
describe("isolamento multi-tenant — cargo (RLS)", () => {
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
    await database.db.delete(cargo);
    await database.db.delete(tenant);
    const [a] = await database.db
      .insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db
      .insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    tenantA = a!.id;
    tenantB = b!.id;
  });

  it("A enxerga apenas os próprios cargos", async () => {
    await database.db.insert(cargo).values({ tenantId: tenantA, nome: "Financeiro", permissoes: ["dinheiro:ver"] });
    await database.db.insert(cargo).values({ tenantId: tenantB, nome: "Compras", permissoes: ["os:avancar"] });

    const vistos = await database.withTenant(tenantA, (tx) => tx.select().from(cargo));
    expect(vistos).toHaveLength(1);
    expect(vistos[0]!.nome).toBe("Financeiro");

    const deB = await database.withTenant(tenantA, (tx) =>
      tx.select().from(cargo).where(eq(cargo.nome, "Compras")),
    );
    expect(deB).toHaveLength(0);
  });

  it("a RLS barra ESCREVER um cargo marcado como de outro tenant (WITH CHECK)", async () => {
    await expect(
      database.withTenant(tenantA, (tx) =>
        tx.insert(cargo).values({ tenantId: tenantB, nome: "Intruso", permissoes: [] }),
      ),
    ).rejects.toThrow();
  });
});
