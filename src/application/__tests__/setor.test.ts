import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarSetor, listarSetoresComEstacoes, moverEstacao, removerSetor } from "@/application/setor";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { estacao, setor, tenant } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

describe("aplicação — setor (isolado por tenant)", () => {
  let database: Database;
  let tenantA: string;
  const sessaoA = () => ({ tenantId: tenantA, usuarioId: "u-a" });

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });
  afterAll(async () => {
    await database.close();
  });
  beforeEach(async () => {
    await database.db.delete(estacao);
    await database.db.delete(setor);
    await database.db.delete(tenant);
    const [a] = await database.db.insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    tenantA = a!.id;
  });

  it("cria setor e lista com estações aninhadas", async () => {
    const s = await criarSetor(database, sessaoA(), "Usinagem");
    await database.db.insert(estacao).values({ tenantId: tenantA, nome: "Bloco", ordem: 1, setorId: s.id });
    const lista = await listarSetoresComEstacoes(database, sessaoA());
    expect(lista).toHaveLength(1);
    expect(lista[0]!.nome).toBe("Usinagem");
    expect(lista[0]!.estacoes.map((e) => e.nome)).toEqual(["Bloco"]);
  });

  it("REJEITA remover setor com estações", async () => {
    const s = await criarSetor(database, sessaoA(), "Usinagem");
    await database.db.insert(estacao).values({ tenantId: tenantA, nome: "Bloco", ordem: 1, setorId: s.id });
    await expect(removerSetor(database, sessaoA(), s.id)).rejects.toThrow(DadosInvalidosError);
  });

  it("remove setor vazio", async () => {
    const s = await criarSetor(database, sessaoA(), "Vazio");
    await removerSetor(database, sessaoA(), s.id);
    const lista = await listarSetoresComEstacoes(database, sessaoA());
    expect(lista).toHaveLength(0);
  });

  it("moverEstacao troca o setor da estação", async () => {
    const a = await criarSetor(database, sessaoA(), "A");
    const b = await criarSetor(database, sessaoA(), "B");
    const [est] = await database.db.insert(estacao).values({ tenantId: tenantA, nome: "Bloco", ordem: 1, setorId: a.id }).returning();
    await moverEstacao(database, sessaoA(), est!.id, b.id);
    const lista = await listarSetoresComEstacoes(database, sessaoA());
    const setorB = lista.find((s) => s.nome === "B")!;
    expect(setorB.estacoes.map((e) => e.nome)).toEqual(["Bloco"]);
  });

  it("rejeita criar setor sem nome", async () => {
    await expect(criarSetor(database, sessaoA(), "   ")).rejects.toThrow(DadosInvalidosError);
  });
});
