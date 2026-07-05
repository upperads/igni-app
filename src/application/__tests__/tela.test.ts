import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { listarTelas, registrarTela, resolverTelaPorToken, revogarTela } from "@/application/tela";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { estacao, tela, tenant, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

vi.mock("@/infra/realtime/notificar", () => ({ notificarPainel: vi.fn().mockResolvedValue(undefined) }));

describe("aplicação — tela", () => {
  let database: Database;
  let tenantA: string;
  let tenantB: string;
  let estacaoA: string;
  let usuarioA: string;
  let usuarioB: string;
  const sessaoA = () => ({ tenantId: tenantA, usuarioId: usuarioA });
  const sessaoB = () => ({ tenantId: tenantB, usuarioId: usuarioB });

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });
  afterAll(async () => {
    await database.close();
  });
  beforeEach(async () => {
    await database.db.delete(tela);
    await database.db.delete(estacao);
    await database.db.delete(usuario);
    await database.db.delete(tenant);
    const [a] = await database.db.insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db.insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    tenantA = a!.id;
    tenantB = b!.id;
    const [ua] = await database.db.insert(usuario).values({ tenantId: tenantA, nome: "Admin A", email: "a@a.com", papel: "dono" }).returning();
    const [ub] = await database.db.insert(usuario).values({ tenantId: tenantB, nome: "Admin B", email: "b@b.com", papel: "dono" }).returning();
    usuarioA = ua!.id;
    usuarioB = ub!.id;
    const [e] = await database.db.insert(estacao).values({ tenantId: tenantA, nome: "Bloco", ordem: 1 }).returning();
    estacaoA = e!.id;
  });

  it("registra e lista só as do próprio tenant", async () => {
    await registrarTela(database, sessaoA(), { nome: "TV Bloco", modo: "estacao", estacaoId: estacaoA });
    await registrarTela(database, sessaoB(), { nome: "Outra", modo: "geral", estacaoId: null });
    const a = await listarTelas(database, sessaoA());
    expect(a).toHaveLength(1);
    expect(a[0]!.nome).toBe("TV Bloco");
    expect(a[0]!.estacaoNome).toBe("Bloco");
  });

  it("REJEITA registrar modo=estacao sem estação (invariante)", async () => {
    await expect(
      registrarTela(database, sessaoA(), { nome: "X", modo: "estacao", estacaoId: null }),
    ).rejects.toThrow(DadosInvalidosError);
  });

  it("resolverTelaPorToken devolve o registro do tenant certo pelo token cru", async () => {
    const { token } = await registrarTela(database, sessaoA(), { nome: "TV Bloco", modo: "estacao", estacaoId: estacaoA });
    const r = await resolverTelaPorToken(database, token);
    expect(r).not.toBeNull();
    expect(r!.tenantId).toBe(tenantA);
    expect(r!.modo).toBe("estacao");
    expect(r!.estacaoId).toBe(estacaoA);
  });

  it("token de tela REVOGADA não resolve", async () => {
    const { token } = await registrarTela(database, sessaoA(), { nome: "TV", modo: "geral", estacaoId: null });
    const [t] = await listarTelas(database, sessaoA());
    await revogarTela(database, sessaoA(), t!.id);
    expect(await resolverTelaPorToken(database, token)).toBeNull();
  });

  it("token inexistente resolve null", async () => {
    expect(await resolverTelaPorToken(database, "nao-existe")).toBeNull();
  });
});
