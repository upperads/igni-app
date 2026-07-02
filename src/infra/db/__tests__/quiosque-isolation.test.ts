import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/infra/db/connection";
import { estacao, quiosqueSetor, tenant, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

/** Isolamento RLS da tabela quiosque_setor (regra de ouro #7): A nunca vê/toca o quiosque de B. */
describe("isolamento multi-tenant — quiosque_setor (RLS)", () => {
  let database: Database;
  let tenantA: string;
  let tenantB: string;
  let estacaoA: string;
  let estacaoB: string;

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    await database.db.delete(quiosqueSetor);
    await database.db.delete(estacao);
    await database.db.delete(usuario);
    await database.db.delete(tenant);

    const [a] = await database.db
      .insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db
      .insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    tenantA = a!.id;
    tenantB = b!.id;
    const [ea] = await database.db
      .insert(estacao).values({ tenantId: tenantA, nome: "Bloco", ordem: 1 }).returning();
    const [eb] = await database.db
      .insert(estacao).values({ tenantId: tenantB, nome: "Bloco", ordem: 1 }).returning();
    estacaoA = ea!.id;
    estacaoB = eb!.id;
  });

  it("A enxerga apenas os próprios quiosques", async () => {
    await database.db.insert(quiosqueSetor).values({
      tenantId: tenantA, estacaoId: estacaoA, tokenHash: "hashA", codigoCurto: "BLOCO-AAAA",
    });
    await database.db.insert(quiosqueSetor).values({
      tenantId: tenantB, estacaoId: estacaoB, tokenHash: "hashB", codigoCurto: "BLOCO-BBBB",
    });

    const vistos = await database.withTenant(tenantA, (tx) => tx.select().from(quiosqueSetor));
    expect(vistos).toHaveLength(1);
    expect(vistos[0]!.tenantId).toBe(tenantA);

    // E buscar diretamente o quiosque de B (por token) não retorna nada sob o tenant de A.
    const deB = await database.withTenant(tenantA, (tx) =>
      tx.select().from(quiosqueSetor).where(eq(quiosqueSetor.tokenHash, "hashB")),
    );
    expect(deB).toHaveLength(0);
  });

  it("a RLS barra ESCREVER um quiosque marcado como de outro tenant (WITH CHECK)", async () => {
    await expect(
      database.withTenant(tenantA, (tx) =>
        tx.insert(quiosqueSetor).values({
          tenantId: tenantB, estacaoId: estacaoB, tokenHash: "hx", codigoCurto: "BLOCO-XXXX",
        }),
      ),
    ).rejects.toThrow();
  });
});
