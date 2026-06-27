import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  adicionarEstacao,
  listarEstacoes,
  removerEstacao,
  renomearEstacao,
  reordenarEstacoes,
} from "@/application/estacao";
import { convidarMembro, desativarMembro, listarEquipe } from "@/application/equipe";
import { estadoImplantacao } from "@/application/implantacao";
import type { SessaoTenant } from "@/application/abrir-os";
import type { Database } from "@/infra/db/connection";
import { estacao, tenant, usuario } from "@/infra/db/schema";
import { FakeAuthIdentity } from "@/test/fake-auth";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

/**
 * Isolamento multi-tenant da Fase de Implantação (regra de ouro #7): equipe (I1) e estações (I2)
 * NUNCA vazam entre tenants — provado através dos CASOS DE USO reais, não só de queries cruas.
 * A RLS (ADR-005) é a defesa em profundidade; aqui exercitamos o caminho que a tela percorre.
 */
describe("implantação — isolamento de equipe e estações", () => {
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
    await database.db.delete(estacao);
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

    const [adminA] = await database.db
      .insert(usuario)
      .values({ tenantId: a!.id, nome: "Admin A", email: "admin@a.com", papel: "dono" })
      .returning();
    const [adminB] = await database.db
      .insert(usuario)
      .values({ tenantId: b!.id, nome: "Admin B", email: "admin@b.com", papel: "dono" })
      .returning();

    sessaoA = { tenantId: a!.id, usuarioId: adminA!.id };
    sessaoB = { tenantId: b!.id, usuarioId: adminB!.id };
  });

  describe("estações", () => {
    it("cada tenant só vê e ordena as próprias estações", async () => {
      await adicionarEstacao(database, sessaoA, "Bloco A");
      await adicionarEstacao(database, sessaoA, "Cabeçote A");
      await adicionarEstacao(database, sessaoB, "Bloco B");

      const daA = await listarEstacoes(database, sessaoA);
      const daB = await listarEstacoes(database, sessaoB);

      expect(daA.map((e) => e.nome)).toEqual(["Bloco A", "Cabeçote A"]);
      expect(daB.map((e) => e.nome)).toEqual(["Bloco B"]);
      // ordem reescrita 1..N por tenant, sem interferência cruzada
      expect(daA.map((e) => e.ordem)).toEqual([1, 2]);
      expect(daB.map((e) => e.ordem)).toEqual([1]);
    });

    it("A não consegue renomear nem remover uma estação de B (RLS não acha a linha)", async () => {
      const [estB] = await database.db
        .insert(estacao)
        .values({ tenantId: sessaoB.tenantId, nome: "Secreta B", ordem: 1 })
        .returning();

      // O UPDATE/DELETE de A não encontra a linha de B → não muda nada, sem vazar.
      await renomearEstacao(database, sessaoA, estB!.id, "Invadida");
      await removerEstacao(database, sessaoA, estB!.id);

      const [aindaLa] = await database.db
        .select()
        .from(estacao)
        .where(eq(estacao.id, estB!.id));
      expect(aindaLa?.nome).toBe("Secreta B");
    });

    it("reordenar com ids de outro tenant é no-op para aqueles ids", async () => {
      const a1 = await adicionarEstacao(database, sessaoA, "A1");
      const [estB] = await database.db
        .insert(estacao)
        .values({ tenantId: sessaoB.tenantId, nome: "B1", ordem: 9 })
        .returning();

      // A tenta reordenar incluindo o id de B: só a dela é afetada.
      await reordenarEstacoes(database, sessaoA, [estB!.id, a1.id]);

      const [bDepois] = await database.db.select().from(estacao).where(eq(estacao.id, estB!.id));
      expect(bDepois?.ordem).toBe(9); // intacta
    });
  });

  describe("equipe", () => {
    const auth = () => ({ database, auth: new FakeAuthIdentity() });

    it("convidar adiciona só ao próprio tenant; o outro não enxerga", async () => {
      await convidarMembro(auth(), sessaoA, {
        nome: "Recep A",
        email: "recep@a.com",
        papel: "recepcao",
      });

      const equipeA = await listarEquipe(database, sessaoA);
      const equipeB = await listarEquipe(database, sessaoB);

      expect(equipeA.map((m) => m.email).sort()).toEqual(["admin@a.com", "recep@a.com"]);
      expect(equipeB.map((m) => m.email)).toEqual(["admin@b.com"]);
    });

    it("desativar marca o membro; ele some dos ativos mas a história fica", async () => {
      const r = await convidarMembro(auth(), sessaoA, {
        nome: "Sai A",
        email: "sai@a.com",
        papel: "producao",
      });
      await desativarMembro(database, sessaoA, r.membroId);

      const equipe = await listarEquipe(database, sessaoA);
      const sai = equipe.find((m) => m.email === "sai@a.com");
      expect(sai?.ativo).toBe(false);
      expect(equipe).toHaveLength(2); // continua na lista, marcado como desativado
    });

    it("a senha provisória vem preenchida (entregue ao dono, não persistida)", async () => {
      const r = await convidarMembro(auth(), sessaoA, {
        nome: "X",
        email: "x@a.com",
        papel: "producao",
      });
      expect(r.senhaProvisoria).toMatch(/^Igni-/);
    });
  });

  describe("estado de implantação", () => {
    it("oficina recém-criada é 'nova' (só admin, sem OS, mas com estações do template)", async () => {
      await adicionarEstacao(database, sessaoA, "Bloco");
      const est = await estadoImplantacao(database, sessaoA);
      expect(est.oficinaNova).toBe(true);
      expect(est.temEquipe).toBe(false);
      expect(est.temEstacoes).toBe(true);
      expect(est.temOs).toBe(false);
    });

    it("ao convidar alguém, deixa de ser 'nova' pelo lado da equipe", async () => {
      await convidarMembro(
        { database, auth: new FakeAuthIdentity() },
        sessaoA,
        { nome: "Y", email: "y@a.com", papel: "recepcao" },
      );
      const est = await estadoImplantacao(database, sessaoA);
      expect(est.temEquipe).toBe(true);
    });
  });
});
