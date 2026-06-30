import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abrirOS, type AbrirOSInput, type SessaoTenant } from "@/application/abrir-os";
import {
  limparDemonstracao,
  semearDemonstracao,
  temDemonstracao,
} from "@/application/demonstracao";
import { relatorioDeGestao } from "@/infra/composition/os";
import type { Database } from "@/infra/db/connection";
import { cliente, entrada, equipamento, evento, orcamento, os, tenant, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

const OS_REAL: AbrirOSInput = {
  cliente: { nome: "Cliente Real", tipo: "avulso" },
  equipamento: { tipo: "Motor real" },
  entrada: { modalidade: "so_usinagem" },
};

describe("demonstração — seed + limpeza reversível", () => {
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
    await database.db.delete(evento);
    await database.db.delete(orcamento);
    await database.db.delete(os);
    await database.db.delete(entrada);
    await database.db.delete(equipamento);
    await database.db.delete(cliente);
    await database.db.delete(usuario);
    await database.db.delete(tenant);

    const [a] = await database.db
      .insert(tenant)
      .values({ nome: "Oficina A", templateRamo: "retifica_leve" })
      .returning();
    const [b] = await database.db
      .insert(tenant)
      .values({ nome: "Oficina B", templateRamo: "centro_automotivo" })
      .returning();
    const [ua] = await database.db
      .insert(usuario)
      .values({ tenantId: a!.id, nome: "Admin A", email: "a@a.com", papel: "dono" })
      .returning();
    const [ub] = await database.db
      .insert(usuario)
      .values({ tenantId: b!.id, nome: "Admin B", email: "b@b.com", papel: "dono" })
      .returning();
    sessaoA = { tenantId: a!.id, usuarioId: ua!.id };
    sessaoB = { tenantId: b!.id, usuarioId: ub!.id };
  });

  it("semear cria várias OS marcadas is_demo, com eventos e orçamentos", async () => {
    const r = await semearDemonstracao(database, sessaoA);
    expect(r.osCriadas).toBeGreaterThanOrEqual(8);

    const todas = await database.db.select().from(os).where(eq(os.tenantId, sessaoA.tenantId));
    expect(todas.length).toBe(r.osCriadas);
    expect(todas.every((o) => o.isDemo)).toBe(true);

    // Cobre todos os estados visíveis no board (não só "aberta").
    const estados = new Set(todas.map((o) => o.estado));
    expect(estados.size).toBeGreaterThanOrEqual(5);

    const eventos = await database.db.select().from(evento).where(eq(evento.tenantId, sessaoA.tenantId));
    expect(eventos.length).toBeGreaterThan(todas.length); // histórico passado
    expect(eventos.every((e) => e.isDemo)).toBe(true);
  });

  it("o seed enche o relatório (responsabilização + adoção do chão)", async () => {
    await semearDemonstracao(database, sessaoA);
    const rel = await relatorioDeGestao(sessaoA, 90);
    expect(rel.adocao.total).toBeGreaterThan(0);
    expect(rel.adocao.chao).toBeGreaterThan(0); // há avanços marcados origem='chao'
    expect(rel.culpa.total).toBeGreaterThan(0); // há esperas (cliente/peça/nossa)
  });

  it("temDemonstracao reflete o estado", async () => {
    expect(await temDemonstracao(database, sessaoA)).toBe(false);
    await semearDemonstracao(database, sessaoA);
    expect(await temDemonstracao(database, sessaoA)).toBe(true);
  });

  it("limpar apaga SÓ o que é demo e PRESERVA a OS real", async () => {
    // Uma OS real (não-demo) + o seed de demo.
    const real = await abrirOS(database, sessaoA, OS_REAL);
    await semearDemonstracao(database, sessaoA);

    await limparDemonstracao(database, sessaoA);

    const restantes = await database.db.select().from(os).where(eq(os.tenantId, sessaoA.tenantId));
    expect(restantes.length).toBe(1);
    expect(restantes[0]!.id).toBe(real.osId);
    expect(restantes[0]!.isDemo).toBe(false);

    // Sem OS de demo, sem evento de demo, e o cliente real continua lá.
    const eventosDemo = await database.db.select().from(evento).where(eq(evento.isDemo, true));
    expect(eventosDemo.length).toBe(0);
    const clientes = await database.db.select().from(cliente).where(eq(cliente.tenantId, sessaoA.tenantId));
    expect(clientes.some((c) => c.nome === "Cliente Real")).toBe(true);
    // Os clientes de demo foram embora.
    expect(clientes.some((c) => c.nome === "Transportes Boi Bravo")).toBe(false);
  });

  it("limpar é idempotente (sem demo, não quebra)", async () => {
    await expect(limparDemonstracao(database, sessaoA)).resolves.toBeUndefined();
  });

  it("isolamento: semear em A não cria nada em B; limpar A não toca B", async () => {
    await semearDemonstracao(database, sessaoA);
    await semearDemonstracao(database, sessaoB);

    const aAntes = await database.db.select().from(os).where(eq(os.tenantId, sessaoA.tenantId));
    const bAntes = await database.db.select().from(os).where(eq(os.tenantId, sessaoB.tenantId));
    expect(aAntes.length).toBeGreaterThan(0);
    expect(bAntes.length).toBeGreaterThan(0);

    await limparDemonstracao(database, sessaoA);

    const aDepois = await database.db.select().from(os).where(eq(os.tenantId, sessaoA.tenantId));
    const bDepois = await database.db.select().from(os).where(eq(os.tenantId, sessaoB.tenantId));
    expect(aDepois.length).toBe(0); // A limpa
    expect(bDepois.length).toBe(bAntes.length); // B intacta
  });
});
