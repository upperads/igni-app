import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SessaoTenant } from "@/application/abrir-os";
import {
  criarServico,
  desativarServico,
  editarServico,
  listarServicos,
  reajustarPrecos,
  reativarServico,
} from "@/application/servico";
import type { Database } from "@/infra/db/connection";
import { servico, tenant, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

describe("servico — aplicação (CRUD + reajuste)", () => {
  let database: Database;
  let sessaoA: SessaoTenant;
  let sessaoB: SessaoTenant;

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });
  afterAll(async () => {
    await database.close();
  });
  beforeEach(async () => {
    await database.db.delete(servico);
    await database.db.delete(usuario);
    await database.db.delete(tenant);
    const [a] = await database.db.insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db.insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    const [ua] = await database.db.insert(usuario).values({ tenantId: a!.id, nome: "Recep A", email: "a@a.com", papel: "recepcao" }).returning();
    const [ub] = await database.db.insert(usuario).values({ tenantId: b!.id, nome: "Recep B", email: "b@b.com", papel: "recepcao" }).returning();
    sessaoA = { tenantId: a!.id, usuarioId: ua!.id };
    sessaoB = { tenantId: b!.id, usuarioId: ub!.id };
  });

  it("cria, lista e edita um serviço no tenant", async () => {
    const { id } = await criarServico(database, sessaoA, { nome: "Plaina", tipo: "mao_de_obra", valorCentavos: 8000, markupPct: 0 });
    let lista = await listarServicos(database, sessaoA);
    expect(lista).toHaveLength(1);
    expect(lista[0]!.nome).toBe("Plaina");
    await editarServico(database, sessaoA, id, { nome: "Plaina de cabeçote", tipo: "mao_de_obra", valorCentavos: 9000, markupPct: 0 });
    lista = await listarServicos(database, sessaoA);
    expect(lista[0]!.nome).toBe("Plaina de cabeçote");
    expect(lista[0]!.valorCentavos).toBe(9000);
  });

  it("desativar tira da lista padrão; incluirInativos mostra; reativar volta", async () => {
    const { id } = await criarServico(database, sessaoA, { nome: "X", tipo: "peca", valorCentavos: 100, markupPct: 0 });
    await desativarServico(database, sessaoA, id);
    expect(await listarServicos(database, sessaoA)).toHaveLength(0);
    expect(await listarServicos(database, sessaoA, { incluirInativos: true })).toHaveLength(1);
    await reativarServico(database, sessaoA, id);
    expect(await listarServicos(database, sessaoA)).toHaveLength(1);
  });

  it("reajuste em massa aplica +10% só nos ATIVOS do tenant", async () => {
    await criarServico(database, sessaoA, { nome: "A1", tipo: "peca", valorCentavos: 10000, markupPct: 0 });
    const inativo = await criarServico(database, sessaoA, { nome: "A2", tipo: "peca", valorCentavos: 5000, markupPct: 0 });
    await desativarServico(database, sessaoA, inativo.id);

    const r = await reajustarPrecos(database, sessaoA, 10);
    expect(r.afetados).toBe(1);
    const todos = await listarServicos(database, sessaoA, { incluirInativos: true });
    const a1 = todos.find((s) => s.nome === "A1")!;
    const a2 = todos.find((s) => s.nome === "A2")!;
    expect(a1.valorCentavos).toBe(11000); // ativo reajustado
    expect(a2.valorCentavos).toBe(5000); // inativo intacto
  });

  it("reajuste rejeita pct fora do intervalo", async () => {
    await expect(reajustarPrecos(database, sessaoA, 999)).rejects.toThrow();
  });

  it("criar/editar REJEITAM a Promise em input inválido (contrato async uniforme, não throw síncrono)", async () => {
    // Se fossem síncronas, .rejects não capturaria o throw da validação. Prova o contrato uniforme.
    await expect(
      criarServico(database, sessaoA, { nome: "", tipo: "peca", valorCentavos: 100, markupPct: 0 }),
    ).rejects.toThrow();
    const { id } = await criarServico(database, sessaoA, { nome: "X", tipo: "peca", valorCentavos: 100, markupPct: 0 });
    await expect(
      editarServico(database, sessaoA, id, { nome: "X", tipo: "peca", valorCentavos: -1, markupPct: 0 }),
    ).rejects.toThrow();
  });

  it("isolamento: reajuste de A não toca serviços de B; A não edita serviço de B", async () => {
    await criarServico(database, sessaoA, { nome: "A1", tipo: "peca", valorCentavos: 10000, markupPct: 0 });
    const b = await criarServico(database, sessaoB, { nome: "B1", tipo: "peca", valorCentavos: 10000, markupPct: 0 });

    await reajustarPrecos(database, sessaoA, 50);
    const [bServ] = await database.db.select().from(servico).where(eq(servico.id, b.id));
    expect(bServ!.valorCentavos).toBe(10000); // B intacto

    // A tenta editar o serviço de B: RLS não acha a linha → no-op
    await editarServico(database, sessaoA, b.id, { nome: "Invadido", tipo: "peca", valorCentavos: 1, markupPct: 0 });
    const [bDepois] = await database.db.select().from(servico).where(eq(servico.id, b.id));
    expect(bDepois!.nome).toBe("B1");
  });
});
