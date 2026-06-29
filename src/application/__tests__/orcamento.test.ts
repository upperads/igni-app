import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abrirOS, type AbrirOSInput, type SessaoTenant } from "@/application/abrir-os";
import { executarTransicao } from "@/application/executar-transicao";
import {
  aprovarCq,
  aprovarOrcamento,
  enviarOrcamento,
  montarOrcamento,
  recusarOrcamento,
  resolverContextoGate,
} from "@/application/orcamento";
import type { ContextoTransicao, EstadoOS } from "@/domain/os/estado";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import {
  cliente,
  entrada,
  equipamento,
  evento,
  orcamento,
  orcamentoItem,
  os,
  tenant,
  usuario,
} from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

const SEM_GATE: ContextoTransicao = { orcamentoAprovado: false, cqAprovado: false };

const INPUT: AbrirOSInput = {
  cliente: { nome: "Cliente", tipo: "avulso" },
  equipamento: { tipo: "Motor" },
  entrada: { modalidade: "so_usinagem" },
};

const ITENS = [
  { tipo: "peca" as const, descricao: "Pistão", valorCentavos: 50_000, markupPct: 0 },
  { tipo: "mao_de_obra" as const, descricao: "Retífica", valorCentavos: 30_000, markupPct: 0 },
];

describe("orçamento — casos de uso e gates reais (US-12/14)", () => {
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
    await database.db.delete(orcamentoItem);
    await database.db.delete(orcamento);
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
      .values({ tenantId: t!.id, nome: "Orc", email: "orc@x.com", papel: "gestor" })
      .returning({ id: usuario.id });
    sessao = { tenantId: t!.id, usuarioId: u!.id };
  });

  function avancar(osId: string, para: EstadoOS, ctx: ContextoTransicao = SEM_GATE) {
    return executarTransicao(database, sessao, { osId, para, contexto: ctx });
  }

  async function ateAguardandoAprovacao(): Promise<string> {
    const { osId } = await abrirOS(database, sessao, INPUT);
    await montarOrcamento(database, sessao, { osId, itens: ITENS });
    await avancar(osId, "diagnostico");
    await avancar(osId, "orcamento");
    await avancar(osId, "aguardando_aprovacao");
    return osId;
  }

  it("monta itens, envia (gera token) e marca enviado", async () => {
    const osId = await ateAguardandoAprovacao();

    const { token } = await enviarOrcamento(database, sessao, osId);
    expect(token.length).toBeGreaterThan(20);

    const [orc] = await database.db.select().from(orcamento).where(eq(orcamento.osId, osId));
    expect(orc?.status).toBe("enviado");
    expect(orc?.tokenHash).toBeTruthy();
    expect(orc?.tokenHash).not.toBe(token); // guarda o hash, não o token cru
    const itens = await database.db.select().from(orcamentoItem).where(eq(orcamentoItem.orcamentoId, orc!.id));
    expect(itens).toHaveLength(2);
  });

  it("aprovar libera o gate de execução; antes, barra", async () => {
    const osId = await ateAguardandoAprovacao();
    await enviarOrcamento(database, sessao, osId);

    // antes de aprovar: contexto real diz não → execução barrada
    const antes = await resolverContextoGate(database, sessao, osId);
    expect(antes.orcamentoAprovado).toBe(false);
    const barrado = await avancar(osId, "execucao", antes);
    expect(barrado.ok).toBe(false);
    expect(barrado.motivo).toMatch(/orçamento aprovado/i);

    await aprovarOrcamento(database, sessao, osId);

    const depois = await resolverContextoGate(database, sessao, osId);
    expect(depois.orcamentoAprovado).toBe(true);
    const liberado = await avancar(osId, "execucao", depois);
    expect(liberado.ok).toBe(true);
  });

  it("aprovação interna com canal grava um evento na linha do tempo (responsabilização honesta)", async () => {
    const osId = await ateAguardandoAprovacao();
    await enviarOrcamento(database, sessao, osId);

    const antes = await database.db.select().from(evento).where(eq(evento.osId, osId));
    await aprovarOrcamento(database, sessao, osId, "whatsapp");
    const depois = await database.db.select().from(evento).where(eq(evento.osId, osId));

    expect(depois.length).toBe(antes.length + 1);
    const novo = depois.find((e) => !antes.some((a) => a.id === e.id));
    expect(novo?.motivo).toMatch(/aprovado pelo cliente por WhatsApp/i);
    expect(novo?.origem).toBe("escritorio");
  });

  it("aprovação SEM canal (ex.: portal do cliente) não grava evento de canal", async () => {
    const osId = await ateAguardandoAprovacao();
    await enviarOrcamento(database, sessao, osId);

    const antes = await database.db.select().from(evento).where(eq(evento.osId, osId));
    await aprovarOrcamento(database, sessao, osId);
    const depois = await database.db.select().from(evento).where(eq(evento.osId, osId));

    expect(depois.length).toBe(antes.length);
  });

  it("recusar volta a OS a diagnóstico", async () => {
    const osId = await ateAguardandoAprovacao();
    await enviarOrcamento(database, sessao, osId);

    const r = await recusarOrcamento(database, sessao, osId);
    expect(r.estado).toBe("diagnostico");

    const [ordem] = await database.db.select().from(os).where(eq(os.id, osId));
    expect(ordem?.estado).toBe("diagnostico");
    const [orc] = await database.db.select().from(orcamento).where(eq(orcamento.osId, osId));
    expect(orc?.status).toBe("recusado");
  });

  it("aprovar CQ libera o gate CQ → pronta; reentrar no CQ zera a aprovação", async () => {
    const osId = await ateAguardandoAprovacao();
    await enviarOrcamento(database, sessao, osId);
    await aprovarOrcamento(database, sessao, osId);
    await avancar(osId, "execucao", await resolverContextoGate(database, sessao, osId));
    await avancar(osId, "controle_qualidade");

    const antes = await resolverContextoGate(database, sessao, osId);
    expect(antes.cqAprovado).toBe(false);
    const barrado = await avancar(osId, "pronta", antes);
    expect(barrado.ok).toBe(false);
    expect(barrado.motivo).toMatch(/controle de qualidade/i);

    await aprovarCq(database, sessao, osId);
    const depois = await resolverContextoGate(database, sessao, osId);
    expect(depois.cqAprovado).toBe(true);

    // reprovado: volta a execução e retorna ao CQ → aprovação zerada
    await avancar(osId, "execucao", depois);
    await avancar(osId, "controle_qualidade");
    const reentrada = await resolverContextoGate(database, sessao, osId);
    expect(reentrada.cqAprovado).toBe(false);
  });

  it("não envia sem itens; não decide orçamento não enviado", async () => {
    const { osId } = await abrirOS(database, sessao, INPUT);
    await montarOrcamento(database, sessao, { osId, itens: [] });
    await expect(enviarOrcamento(database, sessao, osId)).rejects.toBeInstanceOf(DadosInvalidosError);
    await expect(aprovarOrcamento(database, sessao, osId)).rejects.toBeInstanceOf(DadosInvalidosError);
  });
});
