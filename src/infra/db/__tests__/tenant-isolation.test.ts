import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/infra/db/connection";
import { tenant, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

/**
 * Teste OBRIGATÓRIO da Definition of Done da US-01 (RNF-SEC-03): isolamento multi-tenant.
 * Prova que, via `withTenant`, um tenant NUNCA enxerga dados de outro — mesmo que o caso de
 * uso esqueça o `WHERE tenant_id`, a RLS no banco bloqueia (defesa em profundidade, ADR-005).
 */
describe("isolamento multi-tenant (RLS)", () => {
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
    // Seed via conexão privilegiada (bypass RLS), simulando o onboarding de duas oficinas.
    await database.db.delete(usuario);
    await database.db.delete(tenant);

    const [a] = await database.db
      .insert(tenant)
      .values({ nome: "Oficina A", templateRamo: "retifica_leve" })
      .returning();
    const [b] = await database.db
      .insert(tenant)
      .values({ nome: "Oficina B", templateRamo: "centro_automotivo" })
      .returning();
    tenantA = a!.id;
    tenantB = b!.id;

    await database.db
      .insert(usuario)
      .values({ tenantId: tenantA, nome: "Admin A", email: "admin@oficina-a.com", papel: "dono" });
    await database.db
      .insert(usuario)
      .values({ tenantId: tenantB, nome: "Admin B", email: "admin@oficina-b.com", papel: "dono" });
  });

  it("tenant A enxerga apenas os próprios usuários", async () => {
    const rows = await database.withTenant(tenantA, (tx) => tx.select().from(usuario));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("admin@oficina-a.com");
    expect(rows.some((r) => r.tenantId === tenantB)).toBe(false);
  });

  it("tenant A não acessa um usuário do tenant B nem buscando pelo id", async () => {
    const [bUser] = await database.db
      .select()
      .from(usuario)
      .where(eq(usuario.tenantId, tenantB));

    const rows = await database.withTenant(tenantA, (tx) =>
      tx.select().from(usuario).where(eq(usuario.id, bUser!.id)),
    );

    expect(rows).toHaveLength(0);
  });

  it("na tabela tenant, A enxerga apenas a própria oficina", async () => {
    const rows = await database.withTenant(tenantA, (tx) => tx.select().from(tenant));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(tenantA);
  });

  it("withTenant rejeita tenantId inválido com erro claro (fail-closed, sem 500 de cast)", async () => {
    await expect(
      database.withTenant("não-é-uuid", (tx) => tx.select().from(usuario)),
    ).rejects.toThrow(/tenant/i);

    await expect(
      database.withTenant("", (tx) => tx.select().from(usuario)),
    ).rejects.toThrow(/tenant/i);
  });

  it("a RLS bloqueia ESCREVER um registro marcado como de outro tenant (WITH CHECK)", async () => {
    await expect(
      database.withTenant(tenantA, (tx) =>
        tx.insert(usuario).values({
          tenantId: tenantB,
          nome: "Intruso",
          email: "intruso@x.com",
          papel: "producao",
        }),
      ),
    ).rejects.toThrow();

    // E nada foi gravado de fato (checado pela conexão privilegiada).
    const intrusos = await database.db
      .select()
      .from(usuario)
      .where(eq(usuario.email, "intruso@x.com"));
    expect(intrusos).toHaveLength(0);
  });
});
