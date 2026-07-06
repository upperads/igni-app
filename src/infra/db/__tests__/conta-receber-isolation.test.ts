import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abrirOS, type SessaoTenant } from "@/application/abrir-os";
import type { Database } from "@/infra/db/connection";
import { cliente, contaReceber, entrada, equipamento, orcamento, os, tenant, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

const INPUT_OS = {
  cliente: { nome: "Cliente", tipo: "avulso" as const },
  equipamento: { tipo: "Motor" },
  entrada: { modalidade: "so_usinagem" as const },
};

/** Cria um usuário + uma OS + um orçamento no tenant e devolve os ids (para os FKs da conta). */
async function osComOrcamento(
  database: Database,
  tenantId: string,
  emailUsuario: string,
): Promise<{ osId: string; orcamentoId: string }> {
  const [u] = await database.db
    .insert(usuario)
    .values({ tenantId, nome: "Resp", email: emailUsuario, papel: "gestor" })
    .returning({ id: usuario.id });
  const sessao: SessaoTenant = { tenantId, usuarioId: u!.id };
  const { osId } = await abrirOS(database, sessao, INPUT_OS);
  const [orc] = await database.db.insert(orcamento).values({ tenantId, osId }).returning({ id: orcamento.id });
  return { osId, orcamentoId: orc!.id };
}

describe("isolamento multi-tenant — conta_receber (RLS)", () => {
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
    await database.db.delete(contaReceber);
    await database.db.delete(orcamento);
    await database.db.delete(os);
    await database.db.delete(entrada);
    await database.db.delete(equipamento);
    await database.db.delete(cliente);
    await database.db.delete(usuario);
    await database.db.delete(tenant);
    const [a] = await database.db.insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db.insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    tenantA = a!.id;
    tenantB = b!.id;
  });

  it("A enxerga apenas a própria conta", async () => {
    const oa = await osComOrcamento(database, tenantA, "resp-a@x.com");
    const ob = await osComOrcamento(database, tenantB, "resp-b@x.com");
    await database.db.insert(contaReceber).values({ tenantId: tenantA, osId: oa.osId, orcamentoId: oa.orcamentoId, valorCentavos: 15000 });
    await database.db.insert(contaReceber).values({ tenantId: tenantB, osId: ob.osId, orcamentoId: ob.orcamentoId, valorCentavos: 20000 });

    const vistos = await database.withTenant(tenantA, (tx) => tx.select().from(contaReceber));
    expect(vistos).toHaveLength(1);
    expect(vistos[0]!.valorCentavos).toBe(15000);
  });

  it("a RLS barra escrever conta de outro tenant (WITH CHECK)", async () => {
    const ob = await osComOrcamento(database, tenantB, "resp-b2@x.com");
    await expect(
      database.withTenant(tenantA, (tx) =>
        tx.insert(contaReceber).values({ tenantId: tenantB, osId: ob.osId, orcamentoId: ob.orcamentoId, valorCentavos: 100 }),
      ),
    ).rejects.toThrow();
  });
});
