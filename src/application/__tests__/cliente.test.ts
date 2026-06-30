import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abrirOS, type AbrirOSInput, type SessaoTenant } from "@/application/abrir-os";
import { detalheCliente, listarClientes } from "@/application/cliente";
import { atribuirEstacaoAOs } from "@/application/estacao";
import type { Database } from "@/infra/db/connection";
import { cliente, estacao, os, tenant, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

function input(nome: string, whatsapp?: string, equip = "Motor"): AbrirOSInput {
  return {
    cliente: { nome, tipo: "avulso", contatoWhatsapp: whatsapp },
    equipamento: { tipo: equip },
    entrada: { modalidade: "so_usinagem" },
  };
}

describe("clientes (I6) — reuso, listagem, isolamento", () => {
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
    await database.db.delete(os);
    await database.db.delete(estacao);
    await database.db.delete(cliente);
    await database.db.delete(usuario);
    await database.db.delete(tenant);

    const [a] = await database.db.insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db.insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    const [ua] = await database.db.insert(usuario).values({ tenantId: a!.id, nome: "Admin A", email: "a@a.com", papel: "dono" }).returning();
    const [ub] = await database.db.insert(usuario).values({ tenantId: b!.id, nome: "Admin B", email: "b@b.com", papel: "dono" }).returning();
    sessaoA = { tenantId: a!.id, usuarioId: ua!.id };
    sessaoB = { tenantId: b!.id, usuarioId: ub!.id };
  });

  it("abrir 2 OS com o mesmo WhatsApp NÃO duplica o cliente", async () => {
    await abrirOS(database, sessaoA, input("Zé Silva", "(11) 99999-0001", "Motor 1"));
    await abrirOS(database, sessaoA, input("Zé da Silva", "11999990001", "Motor 2"));

    const clientes = await database.db.select().from(cliente).where(eq(cliente.tenantId, sessaoA.tenantId));
    expect(clientes).toHaveLength(1);
    // O nome mais recente prevalece; o WhatsApp fica normalizado.
    expect(clientes[0]!.nome).toBe("Zé da Silva");
    expect(clientes[0]!.contatoWhatsapp).toBe("5511999990001");

    const lista = await listarClientes(database, sessaoA);
    expect(lista).toHaveLength(1);
    expect(lista[0]!.totalOs).toBe(2); // as duas OS no histórico do mesmo cliente
  });

  it("sem WhatsApp, cada OS cria um cliente (não dá pra reusar com segurança)", async () => {
    await abrirOS(database, sessaoA, input("Avulso"));
    await abrirOS(database, sessaoA, input("Avulso"));
    const clientes = await database.db.select().from(cliente).where(eq(cliente.tenantId, sessaoA.tenantId));
    expect(clientes).toHaveLength(2);
  });

  it("WhatsApp diferente → clientes diferentes", async () => {
    await abrirOS(database, sessaoA, input("Um", "11999990001"));
    await abrirOS(database, sessaoA, input("Dois", "11999990002"));
    const lista = await listarClientes(database, sessaoA);
    expect(lista).toHaveLength(2);
  });

  it("busca por nome e por WhatsApp", async () => {
    await abrirOS(database, sessaoA, input("Transportadora Norte", "11988887777"));
    await abrirOS(database, sessaoA, input("Oficina Sul", "11955554444"));

    expect((await listarClientes(database, sessaoA, "norte"))).toHaveLength(1);
    expect((await listarClientes(database, sessaoA, "8888"))).toHaveLength(1);
    expect((await listarClientes(database, sessaoA, "inexistente"))).toHaveLength(0);
  });

  it("detalheCliente traz as OS daquele cliente", async () => {
    const r = await abrirOS(database, sessaoA, input("Cliente X", "11900000000"));
    const det = await detalheCliente(database, sessaoA, r.clienteId);
    expect(det).not.toBeNull();
    expect(det!.os).toHaveLength(1);
    expect(det!.os[0]!.id).toBe(r.osId);
  });

  it("isolamento: cliente de A com o mesmo WhatsApp NÃO é reusado em B", async () => {
    await abrirOS(database, sessaoA, input("Cliente A", "11999990001"));
    await abrirOS(database, sessaoB, input("Cliente B", "11999990001"));

    const listaA = await listarClientes(database, sessaoA);
    const listaB = await listarClientes(database, sessaoB);
    expect(listaA).toHaveLength(1);
    expect(listaB).toHaveLength(1);
    expect(listaA[0]!.nome).toBe("Cliente A");
    expect(listaB[0]!.nome).toBe("Cliente B"); // não vazou o reuso entre tenants
  });
});

describe("estação física na OS (I7)", () => {
  let database: Database;
  let sessao: SessaoTenant;

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    await database.db.delete(os);
    await database.db.delete(estacao);
    await database.db.delete(cliente);
    await database.db.delete(usuario);
    await database.db.delete(tenant);
    const [t] = await database.db.insert(tenant).values({ nome: "T", templateRamo: "retifica_leve" }).returning();
    const [u] = await database.db.insert(usuario).values({ tenantId: t!.id, nome: "Admin", email: "a@t.com", papel: "dono" }).returning();
    sessao = { tenantId: t!.id, usuarioId: u!.id };
  });

  it("atribui e desatribui a estação física de uma OS", async () => {
    const r = await abrirOS(database, sessao, input("C", "11900000000"));
    const [est] = await database.db
      .insert(estacao)
      .values({ tenantId: sessao.tenantId, nome: "Bloco", ordem: 1 })
      .returning();

    await atribuirEstacaoAOs(database, sessao, r.osId, est!.id);
    let [linha] = await database.db.select().from(os).where(eq(os.id, r.osId));
    expect(linha!.estacaoId).toBe(est!.id);

    await atribuirEstacaoAOs(database, sessao, r.osId, null);
    [linha] = await database.db.select().from(os).where(eq(os.id, r.osId));
    expect(linha!.estacaoId).toBeNull();
  });
});
