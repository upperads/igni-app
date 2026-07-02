import { desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abrirOS, type SessaoTenant } from "@/application/abrir-os";
import {
  bumpPorQuiosque,
  definirPin,
  gerarQuiosque,
  hashPin,
  hashToken,
  listarQuiosques,
  resolverQuiosque,
  revogarQuiosque,
} from "@/application/quiosque";
import type { Database } from "@/infra/db/connection";
import {
  cliente,
  entrada,
  equipamento,
  estacao,
  evento,
  os,
  quiosqueSetor,
  tenant,
  usuario,
} from "@/infra/db/schema";
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

describe("quiosque — público (resolver token + bump com PIN)", () => {
  let database: Database;
  let sessaoA: SessaoTenant;
  let estacaoA: string;
  let prodA: string;
  let tokenA: string;
  let codigoCurtoA: string;
  let osId: string;

  // Segundo tenant (B), completo, para os testes de isolamento cruzado A↔B.
  let sessaoB: SessaoTenant;
  let estacaoB: string;
  let prodB: string;
  let tokenB: string;
  let osIdB: string;

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });
  afterAll(async () => {
    await database.close();
  });
  beforeEach(async () => {
    // Ordem das FKs: evento/os referenciam entrada/equipamento/estacao; entrada/equipamento
    // referenciam cliente; quiosque_setor referencia estacao/usuario; usuario/estacao referenciam tenant.
    await database.db.delete(evento);
    await database.db.delete(os);
    await database.db.delete(entrada);
    await database.db.delete(equipamento);
    await database.db.delete(cliente);
    await database.db.delete(quiosqueSetor);
    await database.db.delete(estacao);
    await database.db.delete(usuario);
    await database.db.delete(tenant);

    const [a] = await database.db
      .insert(tenant)
      .values({ nome: "A", templateRamo: "retifica_leve" })
      .returning();
    const [ua] = await database.db
      .insert(usuario)
      .values({ tenantId: a!.id, nome: "Admin A", email: "admin@a.com", papel: "dono" })
      .returning();
    const [prod] = await database.db
      .insert(usuario)
      .values({ tenantId: a!.id, nome: "Zé", email: "ze@a.com", papel: "producao" })
      .returning();
    const [ea] = await database.db
      .insert(estacao)
      .values({ tenantId: a!.id, nome: "Bloco", ordem: 1 })
      .returning();
    sessaoA = { tenantId: a!.id, usuarioId: ua!.id };
    estacaoA = ea!.id;
    prodA = prod!.id;

    await definirPin(database, sessaoA, prodA, "1234");
    const gerado = await gerarQuiosque(database, sessaoA, estacaoA);
    tokenA = gerado.token;
    codigoCurtoA = gerado.codigoCurto;

    const aberta = await abrirOS(database, sessaoA, {
      cliente: { nome: "Cliente", tipo: "avulso" },
      equipamento: { tipo: "Motor" },
      entrada: { modalidade: "so_usinagem" },
    });
    osId = aberta.osId;
    // Coloca a OS na estação do quiosque, em execução (transição válida para controle_qualidade).
    await database.db
      .update(os)
      .set({ estacaoId: estacaoA, estado: "execucao" })
      .where(eq(os.id, osId));

    // --- Tenant B: espelho completo (estação + produtivo com PIN + quiosque + OS) ---
    const [b] = await database.db
      .insert(tenant)
      .values({ nome: "B", templateRamo: "centro_automotivo" })
      .returning();
    const [ub] = await database.db
      .insert(usuario)
      .values({ tenantId: b!.id, nome: "Admin B", email: "admin@b.com", papel: "dono" })
      .returning();
    const [prodBRow] = await database.db
      .insert(usuario)
      .values({ tenantId: b!.id, nome: "João", email: "joao@b.com", papel: "producao" })
      .returning();
    const [eb] = await database.db
      .insert(estacao)
      .values({ tenantId: b!.id, nome: "Usinagem B", ordem: 1 })
      .returning();
    sessaoB = { tenantId: b!.id, usuarioId: ub!.id };
    estacaoB = eb!.id;
    prodB = prodBRow!.id;

    await definirPin(database, sessaoB, prodB, "5678");
    const geradoB = await gerarQuiosque(database, sessaoB, estacaoB);
    tokenB = geradoB.token;

    const abertaB = await abrirOS(database, sessaoB, {
      cliente: { nome: "Cliente B", tipo: "avulso" },
      equipamento: { tipo: "Motor B" },
      entrada: { modalidade: "so_usinagem" },
    });
    osIdB = abertaB.osId;
    await database.db
      .update(os)
      .set({ estacaoId: estacaoB, estado: "execucao" })
      .where(eq(os.id, osIdB));
  });

  it("resolverQuiosque devolve tenant+estacao do registro (não do input); revogado → null", async () => {
    const r = await resolverQuiosque(database, tokenA);
    expect(r).not.toBeNull();
    expect(r!.tenantId).toBe(sessaoA.tenantId);
    expect(r!.estacaoId).toBe(estacaoA);
  });

  it("resolverQuiosque aceita o código curto (entrada de backup) e resolve o mesmo registro", async () => {
    const r = await resolverQuiosque(database, codigoCurtoA);
    expect(r).not.toBeNull();
    expect(r!.tenantId).toBe(sessaoA.tenantId);
    expect(r!.estacaoId).toBe(estacaoA);
  });

  it("resolverQuiosque devolve null para token/código inexistente", async () => {
    const r = await resolverQuiosque(database, "coisa-que-nao-existe-aqui");
    expect(r).toBeNull();
  });

  it("bump com PIN CERTO avança a OS e carimba o usuário do PIN, origem=chao", async () => {
    const r = await bumpPorQuiosque(database, tokenA, osId, "controle_qualidade", "1234", new Date());
    expect(r.ok).toBe(true);

    const [ordem] = await database.db.select().from(os).where(eq(os.id, osId));
    expect(ordem!.estado).toBe("controle_qualidade");

    const [ev] = await database.db
      .select()
      .from(evento)
      .where(eq(evento.osId, osId))
      .orderBy(desc(evento.em))
      .limit(1);
    expect(ev!.porUsuarioId).toBe(prodA);
    expect(ev!.origem).toBe("chao");
    expect(ev!.paraEstado).toBe("controle_qualidade");
  });

  it("bump com PIN ERRADO não avança nada", async () => {
    const r = await bumpPorQuiosque(database, tokenA, osId, "controle_qualidade", "9999", new Date());
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/pin/i);

    const [ordem] = await database.db.select().from(os).where(eq(os.id, osId));
    expect(ordem!.estado).toBe("execucao"); // não mudou
  });

  it("bump para OS de OUTRO setor é recusado (escopo mínimo do quiosque)", async () => {
    const [outraEstacao] = await database.db
      .insert(estacao)
      .values({ tenantId: sessaoA.tenantId, nome: "Usinagem", ordem: 2 })
      .returning();
    await database.db.update(os).set({ estacaoId: outraEstacao!.id }).where(eq(os.id, osId));

    const r = await bumpPorQuiosque(database, tokenA, osId, "controle_qualidade", "1234", new Date());
    expect(r.ok).toBe(false);

    const [ordem] = await database.db.select().from(os).where(eq(os.id, osId));
    expect(ordem!.estado).toBe("execucao"); // não mudou
  });

  it("o quiosque NÃO destranca a execução (trava de gate; só o escritório libera obra)", async () => {
    // OS em aguardando_peca poderia estruturalmente ir a execucao — mas o chão não pode fazer isso.
    await database.db.update(os).set({ estado: "aguardando_peca" }).where(eq(os.id, osId));
    const r = await bumpPorQuiosque(database, tokenA, osId, "execucao", "1234", new Date());
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/escrit[óo]rio/i);
    const [ordem] = await database.db.select().from(os).where(eq(os.id, osId));
    expect(ordem!.estado).toBe("aguardando_peca"); // não mudou
  });

  it("token revogado não resolve (bump falha)", async () => {
    const [q] = await database.db.select().from(quiosqueSetor).limit(1);
    await database.db.update(quiosqueSetor).set({ revogadoEm: new Date() }).where(eq(quiosqueSetor.id, q!.id));

    const resolvido = await resolverQuiosque(database, tokenA);
    expect(resolvido).toBeNull();

    const r = await bumpPorQuiosque(database, tokenA, osId, "controle_qualidade", "1234", new Date());
    expect(r.ok).toBe(false);
  });

  // --- Isolamento entre tenants (o coração da fatia de segurança) ---

  it("resolverQuiosque(tokenB) devolve o tenant/estação de B, nunca de A", async () => {
    const r = await resolverQuiosque(database, tokenB);
    expect(r).not.toBeNull();
    expect(r!.tenantId).toBe(sessaoB.tenantId);
    expect(r!.estacaoId).toBe(estacaoB);
    expect(r!.tenantId).not.toBe(sessaoA.tenantId);
  });

  it("isolamento: token de A não avança OS de B (a OS de B não é da estação do quiosque de A)", async () => {
    const r = await bumpPorQuiosque(database, tokenA, osIdB, "controle_qualidade", "1234", new Date());
    expect(r.ok).toBe(false);

    // Estado da OS de B não mudou.
    const [ordemB] = await database.db.select().from(os).where(eq(os.id, osIdB));
    expect(ordemB!.estado).toBe("execucao");
    // Nenhum evento de TRANSIÇÃO foi gravado por causa dessa tentativa (só sobra o de criação
    // da OS, gravado por `abrirOS` no setup — nunca um `paraEstado: controle_qualidade`).
    const eventosB = await database.db.select().from(evento).where(eq(evento.osId, osIdB));
    expect(eventosB.some((e) => e.paraEstado === "controle_qualidade")).toBe(false);
  });

  it("isolamento: PIN de produção de B não carimba bump no quiosque de A", async () => {
    // "5678" é o PIN do produtivo de B; no quiosque de A (withTenant A), a busca por
    // pinHash+papel+tenantId não encontra ninguém — o usuário de B não existe em A.
    const r = await bumpPorQuiosque(database, tokenA, osId, "controle_qualidade", "5678", new Date());
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/pin/i);

    // Estado da OS de A não mudou.
    const [ordemA] = await database.db.select().from(os).where(eq(os.id, osId));
    expect(ordemA!.estado).toBe("execucao");
    // Só o evento de criação (do setup) existe — nenhuma transição foi carimbada com o PIN de B.
    const eventosA = await database.db.select().from(evento).where(eq(evento.osId, osId));
    expect(eventosA.some((e) => e.paraEstado === "controle_qualidade")).toBe(false);
  });

  it("isolamento: dados do quiosque de A trazem só OS do setor de A (nunca de outro setor/tenant)", async () => {
    // Réplica da leitura de `dadosQuiosque` (composição) com o `database` de teste injetado —
    // a composição usa o singleton de produção (DATABASE_URL), não é injetável para teste local.
    const q = await resolverQuiosque(database, tokenA);
    expect(q).not.toBeNull();

    const cards = await database.withTenant(q!.tenantId, async (tx) => {
      return tx
        .select({ id: os.id, estacaoId: os.estacaoId })
        .from(os)
        .innerJoin(equipamento, eq(equipamento.id, os.equipamentoId))
        .where(eq(os.estacaoId, q!.estacaoId));
    });

    // Só a OS de A aparece — nem a de B (outro tenant), nem nenhuma de outro setor de A.
    expect(cards.map((c) => c.id)).toEqual([osId]);
    expect(cards.every((c) => c.estacaoId === estacaoA)).toBe(true);
    expect(cards.some((c) => c.id === osIdB)).toBe(false);

    // Confirma que a OS de B nem é visível sob o tenant de A, mesmo sem o filtro por estação
    // (a RLS do `withTenant(A)` já barra o dado de B na raiz).
    const todasOsVisiveisEmA = await database.withTenant(q!.tenantId, async (tx) => tx.select({ id: os.id }).from(os));
    expect(todasOsVisiveisEmA.some((o) => o.id === osIdB)).toBe(false);
  });
});
