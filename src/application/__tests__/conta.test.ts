import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abrirOS, type AbrirOSInput, type SessaoTenant } from "@/application/abrir-os";
import { cancelarConta, contaDaOs, desfazerRecebimento, registrarRecebimento } from "@/application/conta";
import { executarTransicao } from "@/application/executar-transicao";
import { aprovarOrcamento, enviarOrcamento, montarOrcamento } from "@/application/orcamento";
import type { ContextoTransicao, EstadoOS } from "@/domain/os/estado";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import {
  cliente,
  contaReceber,
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
  { tipo: "peca" as const, descricao: "Pistão", valorCentavos: 100_000, markupPct: 0 },
  { tipo: "mao_de_obra" as const, descricao: "Retífica", valorCentavos: 50_000, markupPct: 0 },
];
const TOTAL_ITENS = 150_000; // 100000 + 50000, markup 0

describe("conta a receber — nasce/atualiza no aprovarOrcamento; cancelarConta; contaDaOs (P-4a)", () => {
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
    await database.db.delete(contaReceber);
    await database.db.delete(orcamentoItem);
    await database.db.delete(orcamento);
    await database.db.delete(evento);
    await database.db.delete(os);
    await database.db.delete(entrada);
    await database.db.delete(equipamento);
    await database.db.delete(cliente);
    await database.db.delete(usuario);
    await database.db.delete(tenant);

    const [a] = await database.db
      .insert(tenant)
      .values({ nome: "Oficina A", templateRamo: "retifica_leve" })
      .returning({ id: tenant.id });
    const [b] = await database.db
      .insert(tenant)
      .values({ nome: "Oficina B", templateRamo: "centro_automotivo" })
      .returning({ id: tenant.id });
    const [ua] = await database.db
      .insert(usuario)
      .values({ tenantId: a!.id, nome: "Gestor A", email: "gestorA@x.com", papel: "gestor" })
      .returning({ id: usuario.id });
    const [ub] = await database.db
      .insert(usuario)
      .values({ tenantId: b!.id, nome: "Gestor B", email: "gestorB@x.com", papel: "gestor" })
      .returning({ id: usuario.id });
    sessaoA = { tenantId: a!.id, usuarioId: ua!.id };
    sessaoB = { tenantId: b!.id, usuarioId: ub!.id };
  });

  function avancar(sessao: SessaoTenant, osId: string, para: EstadoOS, ctx: ContextoTransicao = SEM_GATE) {
    return executarTransicao(database, sessao, { osId, para, contexto: ctx });
  }

  /** OS + orçamento com os ITENS padrão, até aguardando_aprovacao + enviado. */
  async function ateEnviado(sessao: SessaoTenant, itens = ITENS): Promise<string> {
    const { osId } = await abrirOS(database, sessao, INPUT);
    await montarOrcamento(database, sessao, { osId, itens });
    await avancar(sessao, osId, "diagnostico");
    await avancar(sessao, osId, "orcamento");
    await avancar(sessao, osId, "aguardando_aprovacao");
    await enviarOrcamento(database, sessao, osId);
    return osId;
  }

  it("aprovar o orçamento cria a conta aberta com o total", async () => {
    const osId = await ateEnviado(sessaoA);
    await aprovarOrcamento(database, sessaoA, osId);

    const conta = await contaDaOs(database, sessaoA, osId);
    expect(conta).not.toBeNull();
    expect(conta!.status).toBe("aberta");
    expect(conta!.valorCentavos).toBe(TOTAL_ITENS);
  });

  it("reaprovar com conta aberta atualiza o valor", async () => {
    const osId = await ateEnviado(sessaoA);
    await aprovarOrcamento(database, sessaoA, osId);
    const antes = await contaDaOs(database, sessaoA, osId);
    expect(antes!.valorCentavos).toBe(TOTAL_ITENS);

    // muda os itens do orçamento já aprovado direto no banco (não há caso de uso de
    // "reabrir um aprovado" nesta fatia) e reaprova — a conta aberta acompanha o novo total.
    const [orc] = await database.db.select().from(orcamento).where(eq(orcamento.osId, osId));
    await database.db.delete(orcamentoItem).where(eq(orcamentoItem.orcamentoId, orc!.id));
    await database.db.insert(orcamentoItem).values({
      tenantId: sessaoA.tenantId,
      orcamentoId: orc!.id,
      tipo: "peca",
      descricao: "Pistão único",
      valorCentavos: 20_000,
      markupPct: 0,
    });
    await database.db.update(orcamento).set({ status: "enviado" }).where(eq(orcamento.id, orc!.id));
    await aprovarOrcamento(database, sessaoA, osId);

    const depois = await contaDaOs(database, sessaoA, osId);
    expect(depois!.id).toBe(antes!.id); // mesma conta, não duplicou
    expect(depois!.status).toBe("aberta");
    expect(depois!.valorCentavos).toBe(20_000);
  });

  it("conta recebida NÃO é tocada ao reaprovar", async () => {
    const osId = await ateEnviado(sessaoA);
    await aprovarOrcamento(database, sessaoA, osId);
    const conta = await contaDaOs(database, sessaoA, osId);

    // marca recebida diretamente no banco (prova o congelamento automático, independente do caso de uso de receber)
    await database.db.update(contaReceber).set({ status: "recebida" }).where(eq(contaReceber.id, conta!.id));

    const [orc] = await database.db.select().from(orcamento).where(eq(orcamento.osId, osId));
    await database.db.delete(orcamentoItem).where(eq(orcamentoItem.orcamentoId, orc!.id));
    await database.db.insert(orcamentoItem).values({
      tenantId: sessaoA.tenantId,
      orcamentoId: orc!.id,
      tipo: "peca",
      descricao: "Outra peça",
      valorCentavos: 999_999,
      markupPct: 0,
    });
    await database.db.update(orcamento).set({ status: "enviado" }).where(eq(orcamento.id, orc!.id));
    await aprovarOrcamento(database, sessaoA, osId);

    const depois = await contaDaOs(database, sessaoA, osId);
    expect(depois!.status).toBe("recebida"); // congelada
    expect(depois!.valorCentavos).toBe(TOTAL_ITENS); // valor antigo intacto, não pegou o novo total
  });

  it("conta cancelada REABRE ao reaprovar", async () => {
    const osId = await ateEnviado(sessaoA);
    await aprovarOrcamento(database, sessaoA, osId);
    const conta = await contaDaOs(database, sessaoA, osId);
    await cancelarConta(database, sessaoA, conta!.id);

    const cancelada = await contaDaOs(database, sessaoA, osId);
    expect(cancelada!.status).toBe("cancelada");

    const [orc] = await database.db.select().from(orcamento).where(eq(orcamento.osId, osId));
    await database.db.delete(orcamentoItem).where(eq(orcamentoItem.orcamentoId, orc!.id));
    await database.db.insert(orcamentoItem).values({
      tenantId: sessaoA.tenantId,
      orcamentoId: orc!.id,
      tipo: "peca",
      descricao: "Peça nova",
      valorCentavos: 40_000,
      markupPct: 0,
    });
    await database.db.update(orcamento).set({ status: "enviado" }).where(eq(orcamento.id, orc!.id));
    await aprovarOrcamento(database, sessaoA, osId);

    const reaberta = await contaDaOs(database, sessaoA, osId);
    expect(reaberta!.id).toBe(conta!.id);
    expect(reaberta!.status).toBe("aberta");
    expect(reaberta!.valorCentavos).toBe(40_000);
  });

  it("cancelarConta só funciona de aberta; recebida rejeita", async () => {
    const osId = await ateEnviado(sessaoA);
    await aprovarOrcamento(database, sessaoA, osId);
    const conta = await contaDaOs(database, sessaoA, osId);
    await database.db.update(contaReceber).set({ status: "recebida" }).where(eq(contaReceber.id, conta!.id));

    await expect(cancelarConta(database, sessaoA, conta!.id)).rejects.toThrow(DadosInvalidosError);

    const inalterada = await contaDaOs(database, sessaoA, osId);
    expect(inalterada!.status).toBe("recebida");
  });

  it("cancelarConta em conta inexistente rejeita", async () => {
    await expect(
      cancelarConta(database, sessaoA, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(DadosInvalidosError);
  });

  it("contaDaOs retorna null quando o orçamento ainda não foi aprovado", async () => {
    const osId = await ateEnviado(sessaoA);
    const conta = await contaDaOs(database, sessaoA, osId);
    expect(conta).toBeNull();
  });

  it("isolamento: A não enxerga/cancela a conta de B", async () => {
    const osIdA = await ateEnviado(sessaoA);
    await aprovarOrcamento(database, sessaoA, osIdA);
    const osIdB = await ateEnviado(sessaoB);
    await aprovarOrcamento(database, sessaoB, osIdB);

    const contaB = await contaDaOs(database, sessaoB, osIdB);
    expect(contaB).not.toBeNull();

    // A não vê a conta de B pela leitura escopada à própria OS de A
    const viaA = await contaDaOs(database, sessaoA, osIdB);
    expect(viaA).toBeNull();

    // A tenta cancelar a conta de B: RLS não acha a linha → trata como inexistente
    await expect(cancelarConta(database, sessaoA, contaB!.id)).rejects.toThrow(DadosInvalidosError);

    const contaBDepois = await contaDaOs(database, sessaoB, osIdB);
    expect(contaBDepois!.status).toBe("aberta"); // intacta
  });

  it("registrarRecebimento marca recebida com forma e data (só de aberta)", async () => {
    const osId = await ateEnviado(sessaoA);
    await aprovarOrcamento(database, sessaoA, osId);
    const conta = await contaDaOs(database, sessaoA, osId);
    await registrarRecebimento(database, sessaoA, conta!.id, "pix");
    const depois = await contaDaOs(database, sessaoA, osId);
    expect(depois!.status).toBe("recebida");
    expect(depois!.formaPagamento).toBe("pix");
    expect(depois!.recebidoEm).not.toBeNull();
  });

  it("registrarRecebimento rejeita forma inválida", async () => {
    const osId = await ateEnviado(sessaoA);
    await aprovarOrcamento(database, sessaoA, osId);
    const conta = await contaDaOs(database, sessaoA, osId);
    await expect(registrarRecebimento(database, sessaoA, conta!.id, "bitcoin")).rejects.toThrow(DadosInvalidosError);
  });

  it("registrarRecebimento rejeita conta já recebida (só de aberta)", async () => {
    const osId = await ateEnviado(sessaoA);
    await aprovarOrcamento(database, sessaoA, osId);
    const conta = await contaDaOs(database, sessaoA, osId);
    await registrarRecebimento(database, sessaoA, conta!.id, "dinheiro");
    await expect(registrarRecebimento(database, sessaoA, conta!.id, "pix")).rejects.toThrow(DadosInvalidosError);
  });

  it("desfazerRecebimento volta a aberta e limpa forma/data (só de recebida)", async () => {
    const osId = await ateEnviado(sessaoA);
    await aprovarOrcamento(database, sessaoA, osId);
    const conta = await contaDaOs(database, sessaoA, osId);
    await registrarRecebimento(database, sessaoA, conta!.id, "dinheiro");
    await desfazerRecebimento(database, sessaoA, conta!.id);
    const depois = await contaDaOs(database, sessaoA, osId);
    expect(depois!.status).toBe("aberta");
    expect(depois!.formaPagamento).toBeNull();
    expect(depois!.recebidoEm).toBeNull();
  });

  it("desfazerRecebimento rejeita conta aberta (só de recebida)", async () => {
    const osId = await ateEnviado(sessaoA);
    await aprovarOrcamento(database, sessaoA, osId);
    const conta = await contaDaOs(database, sessaoA, osId);
    await expect(desfazerRecebimento(database, sessaoA, conta!.id)).rejects.toThrow(DadosInvalidosError);
  });
});
