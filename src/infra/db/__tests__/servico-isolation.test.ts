import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/infra/db/connection";
import { servico, tenant } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

/** Isolamento RLS da tabela servico (regra de ouro #7): A nunca vê/toca o catálogo de B. */
describe("isolamento multi-tenant — servico (RLS)", () => {
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
    await database.db.delete(servico);
    await database.db.delete(tenant);
    const [a] = await database.db
      .insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db
      .insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    tenantA = a!.id;
    tenantB = b!.id;
  });

  it("A enxerga apenas os próprios serviços", async () => {
    await database.db.insert(servico).values({
      tenantId: tenantA, nome: "Plaina", tipo: "mao_de_obra", valorCentavos: 8000,
    });
    await database.db.insert(servico).values({
      tenantId: tenantB, nome: "Solda", tipo: "terceiro", valorCentavos: 20000,
    });

    const vistos = await database.withTenant(tenantA, (tx) => tx.select().from(servico));
    expect(vistos).toHaveLength(1);
    expect(vistos[0]!.nome).toBe("Plaina");

    const deB = await database.withTenant(tenantA, (tx) =>
      tx.select().from(servico).where(eq(servico.nome, "Solda")),
    );
    expect(deB).toHaveLength(0);
  });

  it("a RLS barra ESCREVER um serviço marcado como de outro tenant (WITH CHECK)", async () => {
    await expect(
      database.withTenant(tenantA, (tx) =>
        tx.insert(servico).values({
          tenantId: tenantB, nome: "Intruso", tipo: "peca", valorCentavos: 100,
        }),
      ),
    ).rejects.toThrow();
  });
});
