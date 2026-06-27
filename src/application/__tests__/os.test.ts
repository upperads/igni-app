import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abrirOS, type AbrirOSInput, type SessaoTenant } from "@/application/abrir-os";
import { executarTransicao, recallTransicao } from "@/application/executar-transicao";
import type { ContextoTransicao, EstadoOS } from "@/domain/os/estado";
import { OsNaoEncontradaError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { cliente, entrada, equipamento, evento, os, tenant, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

const SEM_GATE: ContextoTransicao = { orcamentoAprovado: false, cqAprovado: false };

const INPUT: AbrirOSInput = {
  cliente: { nome: "Transportes XYZ", tipo: "frota" },
  equipamento: { tipo: "Motor Scania DC13", placa: "ABC1D23" },
  entrada: { modalidade: "so_usinagem" },
  tipoServico: "Retífica completa",
};

describe("abrir OS e transições (US-04 / US-05)", () => {
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
    await database.db.delete(evento);
    await database.db.delete(os);
    await database.db.delete(entrada);
    await database.db.delete(equipamento);
    await database.db.delete(cliente);
    await database.db.delete(usuario);
    await database.db.delete(tenant);

    const [t] = await database.db
      .insert(tenant)
      .values({ nome: "Oficina", templateRamo: "retifica_leve" })
      .returning({ id: tenant.id });
    const [u] = await database.db
      .insert(usuario)
      .values({ tenantId: t!.id, nome: "Recep", email: "rec@x.com", papel: "recepcao" })
      .returning({ id: usuario.id });
    sessao = { tenantId: t!.id, usuarioId: u!.id };
  });

  function avancar(osId: string, para: EstadoOS, ctx: ContextoTransicao = SEM_GATE) {
    return executarTransicao(database, sessao, { osId, para, contexto: ctx });
  }

  it("abre a OS criando cliente/equipamento/entrada + EVENTO de abertura", async () => {
    const r = await abrirOS(database, sessao, INPUT);

    const [ordem] = await database.db.select().from(os).where(eq(os.id, r.osId));
    expect(ordem?.estado).toBe("aberta");
    expect(ordem?.tenantId).toBe(sessao.tenantId);
    expect(ordem?.responsavelId).toBe(sessao.usuarioId);

    const clientes = await database.db.select().from(cliente).where(eq(cliente.id, r.clienteId));
    expect(clientes[0]?.nome).toBe("Transportes XYZ");
    const equips = await database.db.select().from(equipamento).where(eq(equipamento.id, r.equipamentoId));
    expect(equips).toHaveLength(1);
    const entradas = await database.db.select().from(entrada).where(eq(entrada.id, r.entradaId));
    expect(entradas).toHaveLength(1);

    const eventos = await database.db.select().from(evento).where(eq(evento.osId, r.osId));
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.deEstado).toBeNull();
    expect(eventos[0]?.paraEstado).toBe("aberta");
  });

  it("numera as OS sequencialmente por tenant (ADR-011)", async () => {
    const a = await abrirOS(database, sessao, INPUT);
    const b = await abrirOS(database, sessao, INPUT);
    const [oa] = await database.db.select().from(os).where(eq(os.id, a.osId));
    const [ob] = await database.db.select().from(os).where(eq(os.id, b.osId));
    expect(oa?.numero).toBe(1);
    expect(ob?.numero).toBe(2);
  });

  it("executa transição válida, muda o estado e grava o EVENTO", async () => {
    const { osId } = await abrirOS(database, sessao, INPUT);

    const r = await avancar(osId, "diagnostico");
    expect(r.ok).toBe(true);
    expect(r.estado).toBe("diagnostico");

    const [ordem] = await database.db.select().from(os).where(eq(os.id, osId));
    expect(ordem?.estado).toBe("diagnostico");

    const [ev] = await database.db
      .select()
      .from(evento)
      .where(and(eq(evento.osId, osId), eq(evento.paraEstado, "diagnostico")));
    expect(ev?.deEstado).toBe("aberta");
    expect(ev?.porUsuarioId).toBe(sessao.usuarioId);
  });

  it("GATE: barra execução sem orçamento aprovado e libera com aprovação", async () => {
    const { osId } = await abrirOS(database, sessao, INPUT);
    await avancar(osId, "diagnostico");
    await avancar(osId, "orcamento");
    await avancar(osId, "aguardando_aprovacao");

    const barrado = await avancar(osId, "execucao", SEM_GATE);
    expect(barrado.ok).toBe(false);
    expect(barrado.motivo).toMatch(/orçamento aprovado/i);

    // não mudou de estado
    const [parado] = await database.db.select().from(os).where(eq(os.id, osId));
    expect(parado?.estado).toBe("aguardando_aprovacao");

    const liberado = await avancar(osId, "execucao", { orcamentoAprovado: true, cqAprovado: false });
    expect(liberado.ok).toBe(true);
    expect(liberado.estado).toBe("execucao");
  });

  it("barra transição estruturalmente inválida (aberta → execucao)", async () => {
    const { osId } = await abrirOS(database, sessao, INPUT);
    const r = await avancar(osId, "execucao", { orcamentoAprovado: true, cqAprovado: true });
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/inválida/i);
  });

  it("lança OsNaoEncontradaError para uma OS inexistente", async () => {
    await expect(
      avancar("11111111-1111-4111-8111-111111111111", "diagnostico"),
    ).rejects.toBeInstanceOf(OsNaoEncontradaError);
  });

  it("recall desfaz a última transição e grava o EVENTO do desfazer (US-10)", async () => {
    const { osId } = await abrirOS(database, sessao, INPUT);
    await avancar(osId, "diagnostico");
    await avancar(osId, "orcamento");

    const r = await recallTransicao(database, sessao, osId);
    expect(r.ok).toBe(true);
    expect(r.estado).toBe("diagnostico");

    const [ordem] = await database.db.select().from(os).where(eq(os.id, osId));
    expect(ordem?.estado).toBe("diagnostico");

    const eventos = await database.db.select().from(evento).where(eq(evento.osId, osId));
    // abertura + 2 transições + 1 recall
    expect(eventos).toHaveLength(4);
    const recall = eventos.find((e) => e.motivo === "Recall (desfazer)");
    expect(recall?.deEstado).toBe("orcamento");
    expect(recall?.paraEstado).toBe("diagnostico");
  });

  it("recall não desfaz a abertura da OS", async () => {
    const { osId } = await abrirOS(database, sessao, INPUT);
    const r = await recallTransicao(database, sessao, osId);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/abertura/i);
  });
});
