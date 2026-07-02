import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SessaoTenant } from "@/application/abrir-os";
import {
  definirPin,
  gerarQuiosque,
  hashPin,
  hashToken,
  listarQuiosques,
  revogarQuiosque,
} from "@/application/quiosque";
import type { Database } from "@/infra/db/connection";
import { estacao, quiosqueSetor, tenant, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

describe("quiosque — aplicação (admin: gerar/revogar/PIN)", () => {
  let database: Database;
  let sessaoA: SessaoTenant;
  let sessaoB: SessaoTenant;
  let estacaoA: string;
  let prodA: string;

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });
  afterAll(async () => {
    await database.close();
  });
  beforeEach(async () => {
    await database.db.delete(quiosqueSetor);
    await database.db.delete(estacao);
    await database.db.delete(usuario);
    await database.db.delete(tenant);
    const [a] = await database.db.insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db.insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    const [ua] = await database.db.insert(usuario).values({ tenantId: a!.id, nome: "Admin A", email: "a@a.com", papel: "dono" }).returning();
    const [ub] = await database.db.insert(usuario).values({ tenantId: b!.id, nome: "Admin B", email: "b@b.com", papel: "dono" }).returning();
    const [prod] = await database.db.insert(usuario).values({ tenantId: a!.id, nome: "Zé", email: "ze@a.com", papel: "producao" }).returning();
    const [ea] = await database.db.insert(estacao).values({ tenantId: a!.id, nome: "Bloco", ordem: 1 }).returning();
    sessaoA = { tenantId: a!.id, usuarioId: ua!.id };
    sessaoB = { tenantId: b!.id, usuarioId: ub!.id };
    estacaoA = ea!.id;
    prodA = prod!.id;
  });

  it("gerarQuiosque devolve token cru + código, guarda só o hash, no tenant certo", async () => {
    const r = await gerarQuiosque(database, sessaoA, estacaoA);
    expect(r.token.length).toBeGreaterThanOrEqual(32);
    expect(r.codigoCurto).toMatch(/^BLOCO-/);
    const [linha] = await database.db.select().from(quiosqueSetor).where(eq(quiosqueSetor.estacaoId, estacaoA));
    expect(linha!.tokenHash).toBe(hashToken(r.token)); // guarda o HASH, nunca o cru
    expect(linha!.tenantId).toBe(sessaoA.tenantId);
    expect(linha!.revogadoEm).toBeNull();
  });

  it("listarQuiosques mostra ativo; revogarQuiosque o desativa", async () => {
    await gerarQuiosque(database, sessaoA, estacaoA);
    let lista = await listarQuiosques(database, sessaoA);
    expect(lista).toHaveLength(1);
    expect(lista[0]!.ativo).toBe(true);
    await revogarQuiosque(database, sessaoA, lista[0]!.id);
    lista = await listarQuiosques(database, sessaoA);
    expect(lista[0]!.ativo).toBe(false);
  });

  it("definirPin guarda o hash do PIN só para produção", async () => {
    await definirPin(database, sessaoA, prodA, "1234");
    const [u] = await database.db.select().from(usuario).where(eq(usuario.id, prodA));
    expect(u!.pinHash).toBe(hashPin("1234"));
  });

  it("definirPin rejeita PIN inválido e usuário não-produção", async () => {
    await expect(definirPin(database, sessaoA, prodA, "12")).rejects.toThrow();
    const admin = sessaoA.usuarioId;
    await expect(definirPin(database, sessaoA, admin, "1234")).rejects.toThrow();
  });

  it("isolamento: B não revoga o quiosque de A", async () => {
    await gerarQuiosque(database, sessaoA, estacaoA);
    const [q] = await database.db.select().from(quiosqueSetor).where(eq(quiosqueSetor.estacaoId, estacaoA));
    await revogarQuiosque(database, sessaoB, q!.id); // no-op sob a RLS de B
    const [aindaAtivo] = await database.db.select().from(quiosqueSetor).where(eq(quiosqueSetor.id, q!.id));
    expect(aindaAtivo!.revogadoEm).toBeNull();
  });
});
