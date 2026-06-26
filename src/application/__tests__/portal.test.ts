import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abrirOS, type AbrirOSInput, type SessaoTenant } from "@/application/abrir-os";
import { executarTransicao } from "@/application/executar-transicao";
import { enviarOrcamento, montarOrcamento } from "@/application/orcamento";
import { aprovarPorToken, recusarPorToken, resolverToken } from "@/application/portal";
import type { ContextoTransicao } from "@/domain/os/estado";
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
const AGORA = new Date("2026-06-25T12:00:00Z");
const FUTURO = new Date("2026-09-01T12:00:00Z"); // depois da expiração (7 dias)

const INPUT: AbrirOSInput = {
  cliente: { nome: "Cliente", tipo: "avulso" },
  equipamento: { tipo: "Motor" },
  entrada: { modalidade: "so_usinagem" },
  tipoServico: "Retífica",
};

const ITENS = [{ tipo: "peca" as const, descricao: "Pistão", valorCentavos: 50_000, markupPct: 0 }];

describe("portal por token (M6 / ADR-012)", () => {
  let database: Database;

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    for (const t of [orcamentoItem, orcamento, evento, os, entrada, equipamento, cliente, usuario, tenant]) {
      await database.db.delete(t);
    }
  });

  async function criarTenantComOrcamentoEnviado(nome: string): Promise<{ sessao: SessaoTenant; osId: string; token: string }> {
    const [t] = await database.db
      .insert(tenant)
      .values({ nome, templateRamo: "retifica_leve" })
      .returning({ id: tenant.id });
    const [u] = await database.db
      .insert(usuario)
      .values({ tenantId: t!.id, nome: "Recep", email: `r${nome}@x.com`, papel: "recepcao" })
      .returning({ id: usuario.id });
    const sessao: SessaoTenant = { tenantId: t!.id, usuarioId: u!.id };

    const { osId } = await abrirOS(database, sessao, INPUT);
    await montarOrcamento(database, sessao, { osId, itens: ITENS });
    await executarTransicao(database, sessao, { osId, para: "diagnostico", contexto: SEM_GATE });
    await executarTransicao(database, sessao, { osId, para: "orcamento", contexto: SEM_GATE });
    await executarTransicao(database, sessao, { osId, para: "aguardando_aprovacao", contexto: SEM_GATE });
    const { token } = await enviarOrcamento(database, sessao, osId);
    return { sessao, osId, token };
  }

  it("resolve o token para a própria OS/tenant", async () => {
    const a = await criarTenantComOrcamentoEnviado("A");
    const r = await resolverToken(database, a.token, AGORA);
    expect(r?.osId).toBe(a.osId);
    expect(r?.tenantId).toBe(a.sessao.tenantId);
  });

  it("token inválido ou expirado não resolve nada (fail-closed)", async () => {
    const a = await criarTenantComOrcamentoEnviado("A");
    expect(await resolverToken(database, "token-que-nao-existe-0000", AGORA)).toBeNull();
    expect(await resolverToken(database, a.token, FUTURO)).toBeNull(); // expirou
  });

  it("ISOLAMENTO: o token do tenant A só abre a OS de A, nunca a de B", async () => {
    const a = await criarTenantComOrcamentoEnviado("A");
    const b = await criarTenantComOrcamentoEnviado("B");

    const rA = await resolverToken(database, a.token, AGORA);
    const rB = await resolverToken(database, b.token, AGORA);
    expect(rA?.osId).toBe(a.osId);
    expect(rB?.osId).toBe(b.osId);
    expect(rA?.osId).not.toBe(b.osId);
    expect(rA?.tenantId).not.toBe(rB?.tenantId);
  });

  it("aprovar pelo token muda o status e é idempotente", async () => {
    const a = await criarTenantComOrcamentoEnviado("A");
    const r1 = await aprovarPorToken(database, a.token, AGORA);
    expect(r1.ok).toBe(true);

    const [orc] = await database.db.select().from(orcamento).where(eq(orcamento.osId, a.osId));
    expect(orc?.status).toBe("aprovado");

    // repetir não quebra (já aprovado = ok)
    const r2 = await aprovarPorToken(database, a.token, AGORA);
    expect(r2.ok).toBe(true);
  });

  it("recusar pelo token volta a OS a diagnóstico (sem usuário interno)", async () => {
    const a = await criarTenantComOrcamentoEnviado("A");
    const r = await recusarPorToken(database, a.token, AGORA);
    expect(r.ok).toBe(true);

    const [ordem] = await database.db.select().from(os).where(eq(os.id, a.osId));
    expect(ordem?.estado).toBe("diagnostico");
    const [orc] = await database.db.select().from(orcamento).where(eq(orcamento.osId, a.osId));
    expect(orc?.status).toBe("recusado");
    // o evento de recusa pelo link não tem usuário interno
    const eventos = await database.db.select().from(evento).where(eq(evento.osId, a.osId));
    const recusa = eventos.find((e) => e.motivo?.includes("cliente"));
    expect(recusa?.porUsuarioId).toBeNull();
  });
});
