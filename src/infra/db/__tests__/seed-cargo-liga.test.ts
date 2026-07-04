import { and, eq, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CARGOS_SEMENTE } from "@/domain/auth/cargo";
import type { Database } from "@/infra/db/connection";
import { cargo, tenant, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

/**
 * Migration 0024 (seed dos cargos): além de semear os 7 cargos-semente por tenant, LIGA cada
 * usuário EXISTENTE ao cargo do seu papel atual (dono→Dono, gestor→Gestor, recepcao→Recepção,
 * producao→Produção). Os testes de aplicação rodam sobre schema vazio (`resetAndMigrate` aplica
 * a migration ANTES de existir qualquer usuário), então esse UPDATE nunca é exercido com dados
 * de verdade. Este teste reproduz a MESMA lógica de ligação (o UPDATE literal da migration) sobre
 * dados que ele mesmo cria — não re-roda a migration (ela já rodou, uma vez, no resetAndMigrate).
 */
describe("seed 0024 — ligação de usuários pré-existentes ao cargo do papel", () => {
  let database: Database;
  let tenantId: string;

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    await database.db.delete(usuario);
    await database.db.delete(cargo);
    await database.db.delete(tenant);
  });

  it("liga cada usuário existente ao cargo do seu papel", async () => {
    // 1) um tenant.
    const [t] = await database.db
      .insert(tenant)
      .values({ nome: "Oficina Pré-existente", templateRamo: "retifica_leve" })
      .returning();
    tenantId = t!.id;

    // 2) semeia os 7 CARGOS_SEMENTE nesse tenant (espelha o que a migration 0024 insere).
    const cargosPorNome = new Map<string, string>();
    for (const semente of CARGOS_SEMENTE) {
      const [linha] = await database.db
        .insert(cargo)
        .values({
          tenantId,
          nome: semente.nome,
          sistema: semente.sistema,
          chao: semente.chao,
          exige2fa: semente.exige2fa,
          permissoes: [...semente.permissoes],
        })
        .returning({ id: cargo.id, nome: cargo.nome });
      cargosPorNome.set(linha!.nome, linha!.id);
    }
    expect(cargosPorNome.size).toBe(7);

    // 3) 4 usuários EXISTENTES (cargoId NULL), um por papel — o estado real de produção antes
    // da migration rodar: gente logada, sem cargo atribuído ainda.
    const usuarios = [
      { nome: "Dona da Oficina", email: "dona@pre.com", papel: "dono" as const },
      { nome: "Gestor Antigo", email: "gestor@pre.com", papel: "gestor" as const },
      { nome: "Recepcionista", email: "recepcao@pre.com", papel: "recepcao" as const },
      { nome: "Operador de Chão", email: "producao@pre.com", papel: "producao" as const },
    ];
    for (const u of usuarios) {
      await database.db.insert(usuario).values({
        tenantId,
        authUserId: null,
        nome: u.nome,
        email: u.email,
        papel: u.papel,
        cargoId: null,
      });
    }

    // 4) roda o MESMO UPDATE de ligação da migration 0024 (reprodução literal, não re-execução).
    await database.db.execute(sql`
      UPDATE "usuario" u SET cargo_id = c.id
      FROM "cargo" c
      WHERE c.tenant_id = u.tenant_id
        AND u.cargo_id IS NULL
        AND ( (u.papel='dono' AND c.nome='Dono')
           OR (u.papel='gestor' AND c.nome='Gestor')
           OR (u.papel='recepcao' AND c.nome='Recepção')
           OR (u.papel='producao' AND c.nome='Produção') )
    `);

    // 5) cada usuário ficou com o cargoId do cargo cujo nome corresponde ao seu papel.
    const linhas = await database.db
      .select({ email: usuario.email, papel: usuario.papel, cargoId: usuario.cargoId })
      .from(usuario)
      .where(eq(usuario.tenantId, tenantId));

    const porEmail = new Map(linhas.map((l) => [l.email, l]));
    expect(porEmail.get("dona@pre.com")?.cargoId).toBe(cargosPorNome.get("Dono"));
    expect(porEmail.get("gestor@pre.com")?.cargoId).toBe(cargosPorNome.get("Gestor"));
    expect(porEmail.get("recepcao@pre.com")?.cargoId).toBe(cargosPorNome.get("Recepção"));
    expect(porEmail.get("producao@pre.com")?.cargoId).toBe(cargosPorNome.get("Produção"));

    // Nenhum usuário ATIVO ficou com cargo_id nulo (a ligação cobriu 100% dos existentes).
    const [{ n }] = await database.db
      .select({ n: sql<number>`count(*)::int` })
      .from(usuario)
      .where(and(isNull(usuario.cargoId), isNull(usuario.desativadoEm)));
    expect(n).toBe(0);
  });
});
