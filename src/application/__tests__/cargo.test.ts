import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarCargo, editarCargo, excluirCargo, listarCargos, renomearCargo } from "@/application/cargo";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { cargo, tenant } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

describe("aplicação — cargo (isolado por tenant)", () => {
  let database: Database;
  let tenantA: string;
  let tenantB: string;
  const sessaoA = () => ({ tenantId: tenantA, usuarioId: "x" });
  const sessaoB = () => ({ tenantId: tenantB, usuarioId: "y" });

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
    const [a] = await database.db.insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db.insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    tenantA = a!.id;
    tenantB = b!.id;
  });

  it("cria e lista só os do próprio tenant", async () => {
    await criarCargo(database, sessaoA(), { nome: "Financeiro", chao: false, exige2fa: true, permissoes: ["dinheiro:ver"] });
    await criarCargo(database, sessaoB(), { nome: "Outro", chao: false, exige2fa: false, permissoes: ["os:avancar"] });
    const a = await listarCargos(database, sessaoA());
    expect(a).toHaveLength(1);
    expect(a[0]!.nome).toBe("Financeiro");
  });

  it("REJEITA criar cargo de chão com permissão de dinheiro (Piso 2)", async () => {
    await expect(
      criarCargo(database, sessaoA(), { nome: "Chão", chao: true, exige2fa: false, permissoes: ["dinheiro:ver"] }),
    ).rejects.toThrow(DadosInvalidosError);
  });

  it("NÃO permite editar permissões de cargo de sistema", async () => {
    const [semente] = await database.db.insert(cargo).values({
      tenantId: tenantA, nome: "Recepção", sistema: true, chao: false, exige2fa: false, permissoes: ["os:abrir"],
    }).returning();
    await expect(
      editarCargo(database, sessaoA(), semente!.id, { nome: "Recepção", chao: false, exige2fa: false, permissoes: ["config:editar"] }),
    ).rejects.toThrow(DadosInvalidosError);
  });

  it("NÃO permite excluir cargo de sistema", async () => {
    const [semente] = await database.db.insert(cargo).values({
      tenantId: tenantA, nome: "Dono", sistema: true, chao: false, exige2fa: true, permissoes: ["config:editar"],
    }).returning();
    await expect(excluirCargo(database, sessaoA(), semente!.id)).rejects.toThrow(DadosInvalidosError);
  });

  it("NÃO permite renomear o cargo Dono (gate imutável)", async () => {
    const [dono] = await database.db.insert(cargo).values({
      tenantId: tenantA, nome: "Dono", sistema: true, chao: false, exige2fa: true, permissoes: ["config:editar"],
    }).returning();
    await expect(renomearCargo(database, sessaoA(), dono!.id, "Chefe")).rejects.toThrow(DadosInvalidosError);
  });

  it("permite renomear outro cargo de sistema (ex.: Recepção)", async () => {
    const [recep] = await database.db.insert(cargo).values({
      tenantId: tenantA, nome: "Recepção", sistema: true, chao: false, exige2fa: false, permissoes: ["os:abrir"],
    }).returning();
    await renomearCargo(database, sessaoA(), recep!.id, "Atendimento");
    const lista = await listarCargos(database, sessaoA());
    expect(lista.find((c) => c.id === recep!.id)!.nome).toBe("Atendimento");
  });

  it("criarCargo DERIVA exige2fa do gatilho (Piso 3: piso, nunca teto)", async () => {
    // client mandou exige2fa=false, mas equipe:gerir é gatilho → grava true
    const { id } = await criarCargo(database, sessaoA(), { nome: "Supervisor", chao: false, exige2fa: false, permissoes: ["equipe:gerir"] });
    const lista = await listarCargos(database, sessaoA());
    expect(lista.find((c) => c.id === id)!.exige2fa).toBe(true);
  });

  it("criarCargo NÃO força 2FA sem gatilho (dinheiro:ver não dispara)", async () => {
    const { id } = await criarCargo(database, sessaoA(), { nome: "Balcão", chao: false, exige2fa: false, permissoes: ["dinheiro:ver", "os:abrir"] });
    const lista = await listarCargos(database, sessaoA());
    expect(lista.find((c) => c.id === id)!.exige2fa).toBe(false);
  });
});
