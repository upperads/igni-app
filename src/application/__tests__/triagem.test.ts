import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abrirOS, type AbrirOSInput, type SessaoTenant } from "@/application/abrir-os";
import {
  ajustarPrioridade,
  destravar,
  recalcularPrioridade,
  travar,
} from "@/application/triagem";
import { OsNaoEncontradaError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import {
  ajustePrioridade,
  cliente,
  entrada,
  equipamento,
  evento,
  os,
  tenant,
  usuario,
} from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

const AGORA = new Date("2026-06-19T12:00:00Z");

const INPUT: AbrirOSInput = {
  cliente: { nome: "Cliente Avulso", tipo: "avulso" },
  equipamento: { tipo: "Motor MWM" },
  entrada: { modalidade: "so_usinagem" },
};

const OS_INEXISTENTE = "11111111-1111-4111-8111-111111111111";

describe("triagem — casos de uso (US-07 / US-08)", () => {
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
    await database.db.delete(ajustePrioridade);
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

  async function definirPrazo(osId: string, prazo: string) {
    await database.db.update(os).set({ prazoPrometido: prazo }).where(eq(os.id, osId));
  }

  it("recalcula e persiste score + bucket (sem prazo, sem gatilho → baixa)", async () => {
    const { osId } = await abrirOS(database, sessao, INPUT);

    const r = await recalcularPrioridade(database, sessao, osId, AGORA);
    expect(r.score).toBe(0);
    expect(r.prioridade).toBe("baixa");

    const [ordem] = await database.db.select().from(os).where(eq(os.id, osId));
    expect(ordem?.prioridadeScore).toBe(0);
    expect(ordem?.prioridade).toBe("baixa");
  });

  it("o prazo apertado eleva o bucket (2 dias, 8 etapas → alta)", async () => {
    const { osId } = await abrirOS(database, sessao, INPUT);
    await definirPrazo(osId, "2026-06-21");

    const r = await recalcularPrioridade(database, sessao, osId, AGORA);
    expect(r.score).toBeCloseTo(4, 5);
    expect(r.prioridade).toBe("alta");
  });

  it("override fixa a prioridade, registra o ajuste e vence o recálculo", async () => {
    const { osId } = await abrirOS(database, sessao, INPUT);
    await definirPrazo(osId, "2026-06-21");
    await recalcularPrioridade(database, sessao, osId, AGORA); // calculada = alta

    const r = await ajustarPrioridade(database, sessao, {
      osId,
      prioridade: "critica",
      motivo: "Cliente VIP, frota inteira parada",
    });
    expect(r.prioridade).toBe("critica");

    const [ordem] = await database.db.select().from(os).where(eq(os.id, osId));
    expect(ordem?.prioridade).toBe("critica");
    expect(ordem?.prioridadeOverride).toBe("critica");

    const ajustes = await database.db.select().from(ajustePrioridade).where(eq(ajustePrioridade.osId, osId));
    expect(ajustes).toHaveLength(1);
    expect(ajustes[0]?.dePrioridade).toBe("alta");
    expect(ajustes[0]?.paraPrioridade).toBe("critica");
    expect(ajustes[0]?.porUsuarioId).toBe(sessao.usuarioId);

    // recálculo posterior não derruba o override
    const depois = await recalcularPrioridade(database, sessao, osId, AGORA);
    expect(depois.prioridade).toBe("critica");
    expect(depois.score).toBeCloseTo(4, 5); // score segue sendo a urgência calculada
  });

  it("trava e destrava a OS com motivo e responsabilidade (dimensão separada)", async () => {
    const { osId } = await abrirOS(database, sessao, INPUT);

    await travar(database, sessao, { osId, motivo: "Peça em trânsito", responsabilidade: "cliente" });
    let [ordem] = await database.db.select().from(os).where(eq(os.id, osId));
    expect(ordem?.travado).toBe(true);
    expect(ordem?.travamentoMotivo).toBe("Peça em trânsito");
    expect(ordem?.travamentoResponsabilidade).toBe("cliente");

    await destravar(database, sessao, osId);
    [ordem] = await database.db.select().from(os).where(eq(os.id, osId));
    expect(ordem?.travado).toBe(false);
    expect(ordem?.travamentoMotivo).toBeNull();
    expect(ordem?.travamentoResponsabilidade).toBeNull();
  });

  it("lança OsNaoEncontradaError em OS inexistente", async () => {
    await expect(recalcularPrioridade(database, sessao, OS_INEXISTENTE, AGORA)).rejects.toBeInstanceOf(OsNaoEncontradaError);
    await expect(
      ajustarPrioridade(database, sessao, { osId: OS_INEXISTENTE, prioridade: "alta" }),
    ).rejects.toBeInstanceOf(OsNaoEncontradaError);
    await expect(
      travar(database, sessao, { osId: OS_INEXISTENTE, motivo: "x", responsabilidade: "empresa" }),
    ).rejects.toBeInstanceOf(OsNaoEncontradaError);
  });
});
