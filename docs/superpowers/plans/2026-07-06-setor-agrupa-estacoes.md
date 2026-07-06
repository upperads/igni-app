# Setor agrupando estações + TV por setor (P-5a) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduzir um nível `setor` que agrupa `estacao` (dois níveis), migrar a produção sem quebrar (1 setor por estação existente), semear setores em tenants novos, dar uma tela para gerir/reagrupar, e fazer a TV (P-3) mostrar um setor inteiro (`modo=setor`).

**Architecture:** Tabela nova `setor` por tenant (RLS). `estacao` ganha `setor_id`. Migração de dados cria 1 setor por estação e liga. Template do ramo passa a descrever setores→estações; `criar-oficina` semeia. Nova tela `/config/setores` (separada da `/config/estacoes`, que mantém o quiosque). A TV ganha `modo=setor` que filtra os cards pelas estações do setor.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Drizzle ORM + Postgres (Supabase), RLS multi-tenant via `withTenant`, Tailwind v4, Vitest.

## Global Constraints

- **TypeScript strict, zero `any`.** Lint estrito (ESLint flat + boundary guard: `src/app` NUNCA importa `@/infra/db/client` nem `db`/`database`).
- **Isolamento multi-tenant sempre** (regra de ouro #7): toda tabela nova tem `tenant_id` + política RLS **na mesma migration**; todo acesso a dados é testado contra vazamento (A↔B).
- **Migrations só via Drizzle** (`drizzle-kit generate` gera o SQL do schema; RLS e a migração de dados são escritas à mão). Migration cloud: `railway run --service igni-app pnpm db:migrate` (a `DATABASE_URL` do cloud vive nos secrets do Railway; o `.env` local aponta para `127.0.0.1:5442x`).
- **SEM Playwright.** Verificação por typecheck/lint/build/test + curl.
- **CI verde antes do deploy.** Deploy: `railway up --service igni-app --ci`. Commit/push junto (o `git push` mostra um stderr no PowerShell que é SUCESSO — usar Bash).
- **Commits Conventional**; a mensagem termina com: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **A `estacao` NÃO perde a estação física da OS** (`os.estacaoId` intocado — o setor é derivado por join). O quiosque (P-0) e a `/config/estacoes` **não mudam** (quiosque continua por estação — é a P-5b).
- **Invariante do setor**: apagar setor com estações é BLOQUEADO (`DadosInvalidosError`). Nenhuma estação com `setor_id` nulo ao fim da migração.
- **Invariante da TV (estende P-3)**: `modo=setor` exige `setor_id`; `estacao` exige `estacao_id`; `geral` exige ambos nulos.

---

## Estrutura de arquivos

**Criados:**
- `src/infra/db/schema/setor.ts` — tabela `setor`.
- `src/infra/db/migrations/00XX_*.sql` — CREATE TABLE setor + `estacao.setor_id` (gerado).
- `src/infra/db/migrations/00YY_rls_setor.sql` — RLS do setor (à mão).
- `src/infra/db/migrations/00ZZ_seed_setor.sql` — migração de dados: 1 setor por estação + liga (à mão).
- `src/domain/os/setor.ts` — `validarSetor`.
- `src/domain/os/__tests__/setor.test.ts` — teste do domínio.
- `src/application/setor.ts` — CRUD + moverEstacao + listarSetoresComEstacoes.
- `src/application/__tests__/setor.test.ts` — testes de aplicação (isolamento, bloqueios).
- `src/infra/composition/setor.ts` — wrappers `*NoTenant`.
- `src/infra/db/__tests__/setor-isolation.test.ts` — isolamento RLS A↔B.
- `src/app/config/setores/{page.tsx, painel-setores.tsx, actions.ts}` — tela de gestão.
- Migration da TV (Task 4): enum `modo_tela` += setor + `tela.setor_id` (gerado + RLS N/A, é coluna).

**Modificados:**
- `src/infra/db/schema/estacao.ts` — adiciona `setorId`.
- `src/infra/db/schema/enums.ts` — `modoTela` += `setor` (Task 4).
- `src/infra/db/schema/tela.ts` — adiciona `setorId` (Task 4).
- `src/infra/db/schema/index.ts` — exporta `setor`.
- `src/domain/templates/ramo.ts` — de estações planas para setores→estações.
- `src/domain/templates/__tests__/ramo.test.ts` — atualiza o drift.
- `src/application/criar-oficina.ts` — semeia setores + estações ligadas.
- `src/domain/os/tela.ts` — `MODOS_TELA` += setor; `validarTela` cresce (Task 4).
- `src/infra/composition/tela.ts` — `dadosTv` trata `modo=setor` (Task 4).
- `src/application/tela.ts` — `TelaInput`/`registrarTela`/`configurarTela`/`resolverTelaPorToken` ganham `setorId` (Task 4).
- `src/app/config/telas/{painel-telas.tsx, actions.ts}` — opção "Um setor" (Task 4).
- `src/ui/components/app-shell.tsx` — nav ganha "Setores".

---

## Task 1: Schema `setor` + `estacao.setor_id` + RLS + migração + template + seed

**Files:**
- Create: `src/infra/db/schema/setor.ts`
- Modify: `src/infra/db/schema/estacao.ts`, `src/infra/db/schema/index.ts`
- Create (gerado): `src/infra/db/migrations/00XX_*.sql`
- Create (à mão): `src/infra/db/migrations/00YY_rls_setor.sql`, `src/infra/db/migrations/00ZZ_seed_setor.sql`
- Modify: `src/domain/templates/ramo.ts`, `src/domain/templates/__tests__/ramo.test.ts`
- Modify: `src/application/criar-oficina.ts`
- Create: `src/domain/os/setor.ts`, `src/domain/os/__tests__/setor.test.ts`
- Create: `src/infra/db/__tests__/setor-isolation.test.ts`

**Interfaces:**
- Produces: tabela `setor` (export `setor`); `estacao.setorId`; `validarSetor({nome})`; `SETORES_POR_RAMO`/`setoresDoRamo(ramo)` em ramo.ts.

- [ ] **Step 1: Escrever o schema `setor`**

`src/infra/db/schema/setor.ts`:
```typescript
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenant } from "./tenant";

/**
 * Setor (P-5a): agrupamento físico de estações (ex.: Usinagem = bloco + cabeçote + virabrequim…).
 * A TV mostra um setor inteiro. `estacao.setor_id` aponta para cá. Config por tenant, com RLS.
 */
export const setor = pgTable("setor", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  ordem: integer("ordem").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Adicionar `setorId` à estação**

Em `src/infra/db/schema/estacao.ts`, adicionar o import e a coluna (após `ordem`):
```typescript
import { setor } from "./setor";
```
```typescript
  setorId: uuid("setor_id").references(() => setor.id, { onDelete: "set null" }),
```

- [ ] **Step 3: Exportar `setor` no barrel**

Em `src/infra/db/schema/index.ts`:
```typescript
export * from "./setor";
```

- [ ] **Step 4: Gerar a migration do schema**

Confira o maior número em `src/infra/db/migrations/` (hoje é 0027). Run: `pnpm drizzle-kit generate`
Expected: cria `00XX` (0028) com `CREATE TABLE "setor"`, o FK `setor_tenant_id_tenant_id_fk`, `ALTER TABLE "estacao" ADD COLUMN "setor_id" uuid`, e o FK `estacao_setor_id_setor_id_fk`. Anote 00XX e os dois próximos livres 00YY, 00ZZ.

- [ ] **Step 5: RLS do setor (à mão)**

Crie `src/infra/db/migrations/00YY_rls_setor.sql`:
```sql
-- RLS multi-tenant dos setores (P-5a). Mesmo padrão do 0023_rls_cargo:
-- GRANT ao app_user + ENABLE (SEM FORCE) + política de isolamento por tenant.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "setor" TO app_user;--> statement-breakpoint

ALTER TABLE "setor" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY setor_tenant_isolation ON "setor"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
```

- [ ] **Step 6: Migração de dados — 1 setor por estação + liga (à mão)**

Crie `src/infra/db/migrations/00ZZ_seed_setor.sql`. Para cada estação existente cria um setor de mesmo nome/ordem e liga:
```sql
-- Migração sem quebrar (P-5a): cada estação existente vira seu próprio setor (nome/ordem iguais),
-- e a estação é ligada a esse setor. O dono reagrupa depois na tela. Ao fim, NENHUMA estação fica
-- com setor_id nulo. Idempotência via WHERE setor_id IS NULL.

INSERT INTO "setor" (tenant_id, nome, ordem)
SELECT e.tenant_id, e.nome, e.ordem
FROM "estacao" e
WHERE e.setor_id IS NULL;--> statement-breakpoint

UPDATE "estacao" e SET setor_id = s.id
FROM "setor" s
WHERE e.setor_id IS NULL
  AND s.tenant_id = e.tenant_id
  AND s.nome = e.nome
  AND s.ordem = e.ordem;
```
> Nota: o pareamento por (tenant_id, nome, ordem) é seguro porque o INSERT acabou de criar exatamente um setor por estação com esses valores. Se houver estações com nome+ordem idênticos (não deveria — ordem é de fluxo), o UPDATE ligaria ambas ao mesmo setor, o que é aceitável (mesmo nome/ordem = mesmo setor lógico).

- [ ] **Step 7: Registrar as migrations manuais no journal + aplicar**

Adicione as entradas de 00YY e 00ZZ ao `src/infra/db/migrations/meta/_journal.json` (idx incremental, `when` incremental, `tag` = nome sem `.sql`, `breakpoints: true`) — replicando como 0023/0024 (RLS+seed manuais anteriores) estão registrados.
Run: `pnpm db:migrate`
Expected: aplica 00XX/00YY/00ZZ sem erro.

- [ ] **Step 8: Template do ramo → setores→estações**

Substitua `src/domain/templates/ramo.ts` para descrever setores com estações. Novo conteúdo (mantém `RAMOS`, troca `ESTACOES_POR_RAMO` por `SETORES_POR_RAMO`, mantém uma função de compat `estacoesDoRamo` que achata para os testes/consumidores antigos NÃO existirem — na verdade removemos `estacoesDoRamo` e ajustamos os consumidores):
```typescript
/**
 * Ramos de oficina e o que cada template pré-carrega (P-5a): SETORES com suas ESTAÇÕES.
 * Fonte canônica do domínio; o enum `template_ramo` do banco espelha `RAMOS` (teste de drift).
 * Setores de PEÇA agrupam várias estações; FASES viram setor-de-1-estação (o dono funde/apaga
 * o que não usa). Configurável por tenant depois do onboarding (tela /config/setores).
 */
export const RAMOS = ["retifica_pesada_agro", "retifica_leve", "centro_automotivo"] as const;
export type Ramo = (typeof RAMOS)[number];

export interface SetorTemplate {
  readonly nome: string;
  readonly ordem: number;
  readonly estacoes: readonly string[];
}

export const SETORES_POR_RAMO: Record<Ramo, readonly SetorTemplate[]> = {
  retifica_pesada_agro: [
    { nome: "Recebimento", ordem: 1, estacoes: ["Recebimento"] },
    { nome: "Desmontagem + lavagem", ordem: 2, estacoes: ["Desmontagem", "Lavagem"] },
    { nome: "Metrologia", ordem: 3, estacoes: ["Metrologia"] },
    { nome: "Usinagem", ordem: 4, estacoes: ["Bloco", "Cabeçote", "Virabrequim", "Biela", "Tornearia"] },
    { nome: "Bomba e bico", ordem: 5, estacoes: ["Bomba/Bico"] },
    { nome: "Montagem", ordem: 6, estacoes: ["Montagem"] },
    { nome: "Controle de Qualidade", ordem: 7, estacoes: ["Controle de Qualidade"] },
    { nome: "Expedição", ordem: 8, estacoes: ["Expedição"] },
  ],
  retifica_leve: [
    { nome: "Recebimento", ordem: 1, estacoes: ["Recebimento"] },
    { nome: "Desmontagem + lavagem", ordem: 2, estacoes: ["Desmontagem", "Lavagem"] },
    { nome: "Metrologia", ordem: 3, estacoes: ["Metrologia"] },
    { nome: "Usinagem", ordem: 4, estacoes: ["Bloco", "Cabeçote"] },
    { nome: "Montagem", ordem: 5, estacoes: ["Montagem"] },
    { nome: "Controle de Qualidade", ordem: 6, estacoes: ["Controle de Qualidade"] },
    { nome: "Expedição", ordem: 7, estacoes: ["Expedição"] },
  ],
  centro_automotivo: [
    { nome: "Recepção", ordem: 1, estacoes: ["Recepção"] },
    { nome: "Diagnóstico", ordem: 2, estacoes: ["Diagnóstico"] },
    { nome: "Execução", ordem: 3, estacoes: ["Execução"] },
    { nome: "Controle de Qualidade", ordem: 4, estacoes: ["Controle de Qualidade"] },
    { nome: "Entrega", ordem: 5, estacoes: ["Entrega"] },
  ],
};

export function setoresDoRamo(ramo: Ramo): readonly SetorTemplate[] {
  return SETORES_POR_RAMO[ramo];
}
```

- [ ] **Step 9: Atualizar o teste de drift do template**

Substitua `src/domain/templates/__tests__/ramo.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { templateRamo } from "@/infra/db/schema";
import { RAMOS, setoresDoRamo } from "../ramo";

describe("templates de ramo (setores→estações)", () => {
  it("o domínio cobre exatamente os valores do enum do banco (sem drift)", () => {
    expect([...RAMOS].sort()).toEqual([...templateRamo.enumValues].sort());
  });

  it("cada ramo tem setores com ordem única/positiva e ao menos 1 estação cada", () => {
    for (const ramo of RAMOS) {
      const setores = setoresDoRamo(ramo);
      expect(setores.length).toBeGreaterThan(0);
      const ordens = setores.map((s) => s.ordem);
      expect(new Set(ordens).size).toBe(ordens.length);
      expect(ordens.every((o) => o > 0)).toBe(true);
      for (const s of setores) {
        expect(s.nome.trim().length).toBeGreaterThan(0);
        expect(s.estacoes.length).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 10: `criar-oficina` semeia setores + estações ligadas**

Em `src/application/criar-oficina.ts`: trocar o import `estacoesDoRamo` por `setoresDoRamo`, e o bloco de seed de estações (linhas ~60 e ~111-115) por semear setores e, dentro de cada setor, suas estações com `setor_id`. Substituir:
```typescript
import { setoresDoRamo, type Ramo } from "@/domain/templates/ramo";
```
```typescript
  const setores = setoresDoRamo(input.ramo);
```
E dentro da transação, no lugar do insert de estações, inserir setores e depois as estações ligadas:
```typescript
      // Semeia os setores do template e, dentro de cada um, suas estações (P-5a). `ordem` da estação
      // segue a ordem do setor (fluxo geral); o dono reordena depois na tela.
      let ordemEstacao = 0;
      for (const s of setores) {
        const [setorCriado] = await tx
          .insert(setor)
          .values({ tenantId: oficina!.id, nome: s.nome, ordem: s.ordem })
          .returning({ id: setor.id });
        if (s.estacoes.length > 0) {
          await tx.insert(estacao).values(
            s.estacoes.map((nome) => {
              ordemEstacao += 1;
              return { tenantId: oficina!.id, nome, ordem: ordemEstacao, setorId: setorCriado!.id };
            }),
          );
        }
      }
```
E adicionar `setor` ao import do schema:
```typescript
import { cargo, estacao, setor, tenant, usuario } from "@/infra/db/schema";
```
Ajustar o `estacoesCriadas` do resultado: **manter o campo `estacoesCriadas`** no result, somando `setores.reduce((n, s) => n + s.estacoes.length, 0)`. Verificado: `criar-oficina.test.ts` asserta apenas `estacoesCriadas > 0` (linha 47) e `estacoes.length === res.estacoesCriadas` (linha 61) — **NÃO trava em nomes nem números específicos**. Mantendo `estacoesCriadas` coerente com o total de estações inseridas, o teste **passa sem mudança**. (O Step 12 não precisa editar este teste.)

- [ ] **Step 11: Domínio `validarSetor` + teste**

`src/domain/os/setor.ts`:
```typescript
import { DadosInvalidosError } from "@/domain/shared/errors";

/** Valida um setor: nome não vazio. Lança DadosInvalidosError (padrão de validarCargo/validarTela). */
export function validarSetor(input: { nome: string }): void {
  if (!input.nome.trim()) {
    throw new DadosInvalidosError("Dê um nome ao setor.");
  }
}
```
`src/domain/os/__tests__/setor.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { validarSetor } from "@/domain/os/setor";
import { DadosInvalidosError } from "@/domain/shared/errors";

describe("setor — validarSetor", () => {
  it("rejeita nome vazio", () => {
    expect(() => validarSetor({ nome: "   " })).toThrow(DadosInvalidosError);
  });
  it("aceita nome válido", () => {
    expect(() => validarSetor({ nome: "Usinagem" })).not.toThrow();
  });
});
```

- [ ] **Step 12: Teste de isolamento A↔B + ajustar criar-oficina.test**

`src/infra/db/__tests__/setor-isolation.test.ts` (espelha `servico-isolation.test.ts`):
```typescript
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/infra/db/connection";
import { setor, tenant } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

describe("isolamento multi-tenant — setor (RLS)", () => {
  let database: Database;
  let tenantA: string;
  let tenantB: string;

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });
  afterAll(async () => {
    await database.close();
  });
  beforeEach(async () => {
    await database.db.delete(setor);
    await database.db.delete(tenant);
    const [a] = await database.db.insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db.insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    tenantA = a!.id;
    tenantB = b!.id;
  });

  it("A enxerga apenas os próprios setores", async () => {
    await database.db.insert(setor).values({ tenantId: tenantA, nome: "Usinagem", ordem: 1 });
    await database.db.insert(setor).values({ tenantId: tenantB, nome: "Montagem", ordem: 1 });
    const vistos = await database.withTenant(tenantA, (tx) => tx.select().from(setor));
    expect(vistos).toHaveLength(1);
    expect(vistos[0]!.nome).toBe("Usinagem");
  });

  it("a RLS barra escrever setor de outro tenant (WITH CHECK)", async () => {
    await expect(
      database.withTenant(tenantA, (tx) => tx.insert(setor).values({ tenantId: tenantB, nome: "X", ordem: 1 })),
    ).rejects.toThrow();
  });
});
```
Rode `criar-oficina.test.ts` — deve passar SEM mudança (asserta só `estacoesCriadas > 0` e `estacoes.length === res.estacoesCriadas`, mantidos coerentes no Step 10). Se por acaso algum outro teste importar `estacoesDoRamo`/`ESTACOES_POR_RAMO` (removidos), corrija o import para `setoresDoRamo`/`SETORES_POR_RAMO`. Rode a suíte relevante para pegar qualquer consumidor órfão do símbolo antigo: `pnpm test src/application/__tests__/criar-oficina.test.ts` e um grep por `estacoesDoRamo`/`ESTACOES_POR_RAMO` no repo (não deve sobrar nenhum).

- [ ] **Step 13: Rodar testes + pipeline**

Run: `pnpm test src/domain/os/__tests__/setor.test.ts src/domain/templates/__tests__/ramo.test.ts src/infra/db/__tests__/setor-isolation.test.ts src/application/__tests__/criar-oficina.test.ts` — todos passam. Depois `pnpm typecheck && pnpm lint && pnpm build`.
Expected: verdes.

- [ ] **Step 14: Commit**

```bash
git add src/infra/db/schema/ src/infra/db/migrations/ src/domain/templates/ramo.ts src/domain/templates/__tests__/ramo.test.ts src/application/criar-oficina.ts src/domain/os/setor.ts src/domain/os/__tests__/setor.test.ts src/infra/db/__tests__/setor-isolation.test.ts src/application/__tests__/criar-oficina.test.ts
git commit -m "feat(setor): schema + RLS + migração (1 setor/estação) + template setores→estações (P-5a fatia 1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Aplicação + composição de setor

**Files:**
- Create: `src/application/setor.ts`, `src/application/__tests__/setor.test.ts`
- Create: `src/infra/composition/setor.ts`

**Interfaces:**
- Consumes: `validarSetor` de `@/domain/os/setor`; `Database`, `withTenant`; `setor`, `estacao` do schema; `SessaoTenant` de `@/application/abrir-os`.
- Produces:
  - `SetorView = { id; nome; ordem }`.
  - `EstacaoDoSetor = { id; nome; ordem; setorId: string | null }`.
  - `SetorComEstacoes = { id; nome; ordem; estacoes: EstacaoDoSetor[] }`.
  - `listarSetores(database, sessao): Promise<SetorView[]>`.
  - `listarSetoresComEstacoes(database, sessao): Promise<SetorComEstacoes[]>`.
  - `criarSetor(database, sessao, nome): Promise<SetorView>`.
  - `renomearSetor(database, sessao, id, nome): Promise<void>`.
  - `reordenarSetores(database, sessao, idsNaOrdem): Promise<void>`.
  - `removerSetor(database, sessao, id): Promise<void>` — bloqueia se tem estações.
  - `moverEstacao(database, sessao, estacaoId, setorId): Promise<void>`.

- [ ] **Step 1: Escrever os testes de aplicação (RED)**

`src/application/__tests__/setor.test.ts`:
```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarSetor, listarSetoresComEstacoes, moverEstacao, removerSetor } from "@/application/setor";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { estacao, setor, tenant } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

describe("aplicação — setor (isolado por tenant)", () => {
  let database: Database;
  let tenantA: string;
  const sessaoA = () => ({ tenantId: tenantA, usuarioId: "u-a" });

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });
  afterAll(async () => {
    await database.close();
  });
  beforeEach(async () => {
    await database.db.delete(estacao);
    await database.db.delete(setor);
    await database.db.delete(tenant);
    const [a] = await database.db.insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    tenantA = a!.id;
  });

  it("cria setor e lista com estações aninhadas", async () => {
    const s = await criarSetor(database, sessaoA(), "Usinagem");
    await database.db.insert(estacao).values({ tenantId: tenantA, nome: "Bloco", ordem: 1, setorId: s.id });
    const lista = await listarSetoresComEstacoes(database, sessaoA());
    expect(lista).toHaveLength(1);
    expect(lista[0]!.nome).toBe("Usinagem");
    expect(lista[0]!.estacoes.map((e) => e.nome)).toEqual(["Bloco"]);
  });

  it("REJEITA remover setor com estações", async () => {
    const s = await criarSetor(database, sessaoA(), "Usinagem");
    await database.db.insert(estacao).values({ tenantId: tenantA, nome: "Bloco", ordem: 1, setorId: s.id });
    await expect(removerSetor(database, sessaoA(), s.id)).rejects.toThrow(DadosInvalidosError);
  });

  it("remove setor vazio", async () => {
    const s = await criarSetor(database, sessaoA(), "Vazio");
    await removerSetor(database, sessaoA(), s.id);
    const lista = await listarSetoresComEstacoes(database, sessaoA());
    expect(lista).toHaveLength(0);
  });

  it("moverEstacao troca o setor da estação", async () => {
    const a = await criarSetor(database, sessaoA(), "A");
    const b = await criarSetor(database, sessaoA(), "B");
    const [est] = await database.db.insert(estacao).values({ tenantId: tenantA, nome: "Bloco", ordem: 1, setorId: a.id }).returning();
    await moverEstacao(database, sessaoA(), est!.id, b.id);
    const lista = await listarSetoresComEstacoes(database, sessaoA());
    const setorB = lista.find((s) => s.nome === "B")!;
    expect(setorB.estacoes.map((e) => e.nome)).toEqual(["Bloco"]);
  });

  it("rejeita criar setor sem nome", async () => {
    await expect(criarSetor(database, sessaoA(), "   ")).rejects.toThrow(DadosInvalidosError);
  });
});
```

- [ ] **Step 2: Rodar (RED)**

Run: `pnpm test src/application/__tests__/setor.test.ts`
Expected: FAIL (`@/application/setor` não existe).

- [ ] **Step 3: Escrever a aplicação**

`src/application/setor.ts`:
```typescript
import { asc, eq, max } from "drizzle-orm";
import { validarSetor } from "@/domain/os/setor";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { estacao, setor } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/**
 * Gestão dos SETORES (P-5a): agrupam estações. CRUD escopado por tenant (withTenant → RLS). Remover
 * setor com estações é bloqueado (o dono move as estações antes). validarSetor roda ANTES do withTenant
 * (throw vira rejeição de Promise — contrato uniforme).
 */
export interface SetorView {
  id: string;
  nome: string;
  ordem: number;
}
export interface EstacaoDoSetor {
  id: string;
  nome: string;
  ordem: number;
  setorId: string | null;
}
export interface SetorComEstacoes {
  id: string;
  nome: string;
  ordem: number;
  estacoes: EstacaoDoSetor[];
}

export function listarSetores(database: Database, sessao: SessaoTenant): Promise<SetorView[]> {
  return database.withTenant(sessao.tenantId, (tx) =>
    tx.select({ id: setor.id, nome: setor.nome, ordem: setor.ordem }).from(setor).orderBy(asc(setor.ordem)),
  );
}

export function listarSetoresComEstacoes(database: Database, sessao: SessaoTenant): Promise<SetorComEstacoes[]> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const setores = await tx
      .select({ id: setor.id, nome: setor.nome, ordem: setor.ordem })
      .from(setor)
      .orderBy(asc(setor.ordem));
    const estacoes = await tx
      .select({ id: estacao.id, nome: estacao.nome, ordem: estacao.ordem, setorId: estacao.setorId })
      .from(estacao)
      .orderBy(asc(estacao.ordem));
    return setores.map((s) => ({
      ...s,
      estacoes: estacoes.filter((e) => e.setorId === s.id),
    }));
  });
}

export async function criarSetor(database: Database, sessao: SessaoTenant, nomeBruto: string): Promise<SetorView> {
  validarSetor({ nome: nomeBruto });
  const nome = nomeBruto.trim();
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [m] = await tx.select({ max: max(setor.ordem) }).from(setor);
    const ordem = (m?.max ?? 0) + 1;
    const [nova] = await tx
      .insert(setor)
      .values({ tenantId: sessao.tenantId, nome, ordem })
      .returning({ id: setor.id, nome: setor.nome, ordem: setor.ordem });
    return nova!;
  });
}

export async function renomearSetor(database: Database, sessao: SessaoTenant, id: string, nomeBruto: string): Promise<void> {
  validarSetor({ nome: nomeBruto });
  const nome = nomeBruto.trim();
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx.update(setor).set({ nome }).where(eq(setor.id, id));
  });
}

export function reordenarSetores(database: Database, sessao: SessaoTenant, idsNaOrdem: string[]): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    let i = 1;
    for (const id of idsNaOrdem) {
      await tx.update(setor).set({ ordem: i }).where(eq(setor.id, id));
      i += 1;
    }
  });
}

export function removerSetor(database: Database, sessao: SessaoTenant, id: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [comEstacao] = await tx.select({ id: estacao.id }).from(estacao).where(eq(estacao.setorId, id)).limit(1);
    if (comEstacao) {
      throw new DadosInvalidosError("Mova as estações antes de remover o setor.");
    }
    await tx.delete(setor).where(eq(setor.id, id));
  });
}

export function moverEstacao(database: Database, sessao: SessaoTenant, estacaoId: string, setorId: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [alvo] = await tx.select({ id: setor.id }).from(setor).where(eq(setor.id, setorId)).limit(1);
    if (!alvo) {
      throw new DadosInvalidosError("Setor não encontrado.");
    }
    await tx.update(estacao).set({ setorId }).where(eq(estacao.id, estacaoId));
  });
}
```

- [ ] **Step 4: Rodar (verde)**

Run: `pnpm test src/application/__tests__/setor.test.ts`
Expected: 5/5 PASS.

- [ ] **Step 5: Composição**

`src/infra/composition/setor.ts`:
```typescript
import type { SessaoTenant } from "@/application/abrir-os";
import {
  criarSetor,
  listarSetores,
  listarSetoresComEstacoes,
  moverEstacao,
  removerSetor,
  renomearSetor,
  reordenarSetores,
  type SetorComEstacoes,
  type SetorView,
} from "@/application/setor";
import { database } from "@/infra/db/client";

/** Composição dos setores (P-5a): liga os casos de uso ao tenant. A web importa daqui. */
export type { SetorView, SetorComEstacoes };

export function listarSetoresNoTenant(sessao: SessaoTenant): Promise<SetorView[]> {
  return listarSetores(database, sessao);
}
export function listarSetoresComEstacoesNoTenant(sessao: SessaoTenant): Promise<SetorComEstacoes[]> {
  return listarSetoresComEstacoes(database, sessao);
}
export function criarSetorNoTenant(sessao: SessaoTenant, nome: string): Promise<SetorView> {
  return criarSetor(database, sessao, nome);
}
export function renomearSetorNoTenant(sessao: SessaoTenant, id: string, nome: string): Promise<void> {
  return renomearSetor(database, sessao, id, nome);
}
export function reordenarSetoresNoTenant(sessao: SessaoTenant, ids: string[]): Promise<void> {
  return reordenarSetores(database, sessao, ids);
}
export function removerSetorNoTenant(sessao: SessaoTenant, id: string): Promise<void> {
  return removerSetor(database, sessao, id);
}
export function moverEstacaoNoTenant(sessao: SessaoTenant, estacaoId: string, setorId: string): Promise<void> {
  return moverEstacao(database, sessao, estacaoId, setorId);
}
```

- [ ] **Step 6: typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: verdes.

- [ ] **Step 7: Commit**

```bash
git add src/application/setor.ts src/application/__tests__/setor.test.ts src/infra/composition/setor.ts
git commit -m "feat(setor): aplicação — CRUD + moverEstacao + remover bloqueia se tem estações (P-5a fatia 2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Tela `/config/setores` + nav

**Files:**
- Create: `src/app/config/setores/{page.tsx, painel-setores.tsx, actions.ts}`
- Modify: `src/ui/components/app-shell.tsx`

**Interfaces:**
- Consumes: `listarSetoresComEstacoesNoTenant`, `criarSetorNoTenant`, `renomearSetorNoTenant`, `reordenarSetoresNoTenant`, `removerSetorNoTenant`, `moverEstacaoNoTenant`, `type SetorComEstacoes` de `@/infra/composition/setor`; `pode` de `@/domain/auth/rbac`; `sessaoAtual`.
- Produces: rota `/config/setores`; item de nav "Setores".

- [ ] **Step 1: Escrever as server actions com RBAC no boundary**

`src/app/config/setores/actions.ts` (espelha `estacoes/actions.ts`: helper `autorizar("config:editar")`):
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { type Permissao, pode } from "@/domain/auth/rbac";
import { DadosInvalidosError } from "@/domain/shared/errors";
import { type SessaoUsuario, sessaoAtual } from "@/infra/auth/sessao";
import {
  criarSetorNoTenant,
  moverEstacaoNoTenant,
  removerSetorNoTenant,
  renomearSetorNoTenant,
  reordenarSetoresNoTenant,
} from "@/infra/composition/setor";

async function autorizar(acao: Permissao): Promise<{ sessao: SessaoUsuario } | { erro: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) return { erro: "Sua sessão expirou. Entre novamente." };
  if (!pode(sessao.permissoes, acao)) return { erro: "Você não tem permissão para configurar os setores." };
  return { sessao };
}

export interface ResultadoAcao {
  ok: boolean;
  motivo?: string;
}

export async function acaoCriarSetor(nome: string): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await criarSetorNoTenant(auth.sessao, nome);
    revalidatePath("/config/setores");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível criar o setor." };
  }
}

export async function acaoRenomearSetor(id: string, nome: string): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await renomearSetorNoTenant(auth.sessao, id, nome);
    revalidatePath("/config/setores");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível renomear." };
  }
}

export async function acaoReordenarSetores(idsNaOrdem: string[]): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await reordenarSetoresNoTenant(auth.sessao, idsNaOrdem);
    revalidatePath("/config/setores");
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível reordenar." };
  }
}

export async function acaoRemoverSetor(id: string): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await removerSetorNoTenant(auth.sessao, id);
    revalidatePath("/config/setores");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível remover." };
  }
}

export async function acaoMoverEstacao(estacaoId: string, setorId: string): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await moverEstacaoNoTenant(auth.sessao, estacaoId, setorId);
    revalidatePath("/config/setores");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível mover a estação." };
  }
}
```

- [ ] **Step 2: Escrever a página (server component)**

`src/app/config/setores/page.tsx`:
```typescript
import { redirect } from "next/navigation";
import { pode } from "@/domain/auth/rbac";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarSetoresComEstacoesNoTenant } from "@/infra/composition/setor";
import { AppShell } from "@/ui/components/app-shell";
import { CabecalhoTela } from "@/ui/components/cabecalho-tela";
import { PainelSetores } from "./painel-setores";

export default async function SetoresPage() {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }
  if (!pode(sessao.permissoes, "config:editar")) {
    redirect("/");
  }
  const setores = await listarSetoresComEstacoesNoTenant(sessao);
  return (
    <AppShell>
      <CabecalhoTela
        etiqueta="Chão"
        titulo="Setores"
        sub="Agrupe as estações nos setores físicos da oficina (Usinagem, Montagem…). A TV mostra um setor inteiro. Mova estações entre setores; crie e reordene os setores."
      />
      <PainelSetores setores={setores} />
    </AppShell>
  );
}
```
> Confirme o padrão de `CabecalhoTela` (props `etiqueta/titulo/sub`) contra `estacoes/page.tsx` ou `cargos/page.tsx`; ajuste se divergir.

- [ ] **Step 3: Escrever o painel (client component)**

`src/app/config/setores/painel-setores.tsx` — setores como grupos, estações aninhadas; cada estação com um `<select>` de setor (mover); CRUD de setor (adicionar/renomear/↑↓/remover). Segue o padrão de `editor-estacoes.tsx` (useTransition, confirmação, ↑↓). Estrutura:
```typescript
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SetorComEstacoes } from "@/infra/composition/setor";
import {
  acaoCriarSetor,
  acaoMoverEstacao,
  acaoRemoverSetor,
  acaoRenomearSetor,
  acaoReordenarSetores,
} from "./actions";

export function PainelSetores({ setores }: { setores: SetorComEstacoes[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState("");

  function rodar(acao: () => Promise<{ ok: boolean; motivo?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) {
        setErro(r.motivo ?? "Não deu certo.");
        return;
      }
      router.refresh();
    });
  }

  function mover(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= setores.length) return;
    const ids = setores.map((s) => s.id);
    [ids[indice], ids[alvo]] = [ids[alvo]!, ids[indice]!];
    rodar(() => acaoReordenarSetores(ids));
  }

  const opcoesSetor = setores.map((s) => ({ id: s.id, nome: s.nome }));

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {setores.map((s, i) => (
          <li key={s.id} className="rounded-lg border border-grafite-700 bg-grafite-850 p-3">
            <div className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-grafite-700 font-mono text-sm text-aco-300">
                {i + 1}
              </span>
              <NomeEditavel
                nome={s.nome}
                pendente={pendente}
                onRenomear={(nome) => rodar(() => acaoRenomearSetor(s.id, nome))}
              />
              <div className="flex items-center gap-1">
                <BotaoIcone aria-label="Subir" disabled={pendente || i === 0} onClick={() => mover(i, -1)}>↑</BotaoIcone>
                <BotaoIcone aria-label="Descer" disabled={pendente || i === setores.length - 1} onClick={() => mover(i, 1)}>↓</BotaoIcone>
                <BotaoIcone aria-label="Remover setor" disabled={pendente} onClick={() => rodar(() => acaoRemoverSetor(s.id))}>×</BotaoIcone>
              </div>
            </div>
            <ul className="mt-2 flex flex-col gap-1 border-t border-grafite-700 pt-2 pl-11">
              {s.estacoes.length === 0 ? (
                <li className="font-body text-xs text-aco-500">Sem estações neste setor.</li>
              ) : (
                s.estacoes.map((e) => (
                  <li key={e.id} className="flex items-center gap-2">
                    <span className="flex-1 font-body text-sm text-aco-200">{e.nome}</span>
                    <select
                      value={s.id}
                      aria-label={`Setor da estação ${e.nome}`}
                      disabled={pendente}
                      onChange={(ev) => rodar(() => acaoMoverEstacao(e.id, ev.target.value))}
                      className="rounded-md border border-grafite-600 bg-grafite-900 px-2 py-1 font-body text-xs text-aco-100"
                    >
                      {opcoesSetor.map((o) => (
                        <option key={o.id} value={o.id}>{o.nome}</option>
                      ))}
                    </select>
                  </li>
                ))
              )}
            </ul>
          </li>
        ))}
      </ol>

      <div className="flex gap-2">
        <input
          value={novo}
          onChange={(ev) => setNovo(ev.target.value)}
          onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); if (novo.trim()) rodar(async () => { const r = await acaoCriarSetor(novo.trim()); if (r.ok) setNovo(""); return r; }); } }}
          placeholder="Nome do novo setor (ex.: Usinagem)"
          className="flex-1 rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
        />
        <button
          type="button"
          disabled={pendente || !novo.trim()}
          onClick={() => rodar(async () => { const r = await acaoCriarSetor(novo.trim()); if (r.ok) setNovo(""); return r; })}
          className="rounded-md bg-ambar-500 px-4 py-2 font-display text-sm font-bold text-grafite-900 hover:bg-ambar-600 disabled:opacity-50"
        >
          Adicionar setor
        </button>
      </div>

      {erro ? <p role="alert" className="font-body text-sm text-sinal-vermelho">{erro}</p> : null}
    </div>
  );
}

function NomeEditavel({ nome, pendente, onRenomear }: { nome: string; pendente: boolean; onRenomear: (n: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(nome);
  function salvar() {
    const limpo = v.trim();
    if (limpo && limpo !== nome) onRenomear(limpo);
    else setV(nome);
    setEditando(false);
  }
  return editando ? (
    <input
      autoFocus
      value={v}
      disabled={pendente}
      onChange={(e) => setV(e.target.value)}
      onBlur={salvar}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); salvar(); } if (e.key === "Escape") { setV(nome); setEditando(false); } }}
      className="flex-1 rounded-md border border-ambar-500 bg-grafite-900 px-2 py-1 font-body text-sm text-aco-100 focus:outline-none"
    />
  ) : (
    <button type="button" onClick={() => setEditando(true)} className="flex-1 text-left font-display text-base text-aco-100 hover:text-ambar-500">
      {nome}
    </button>
  );
}

function BotaoIcone({ children, onClick, disabled, "aria-label": ariaLabel }: { children: React.ReactNode; onClick: () => void; disabled: boolean; "aria-label": string }) {
  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick} disabled={disabled} className="grid size-8 place-items-center rounded-md border border-grafite-600 font-mono text-base text-aco-300 transition-colors hover:border-aco-400 hover:text-aco-100 disabled:opacity-30">
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Adicionar "Setores" à nav de config**

Em `src/ui/components/app-shell.tsx`, o array `NAV_CONFIG`: adicionar "Setores" ANTES de "Estações" (o setor é o nível de cima):
```typescript
const NAV_CONFIG = [
  { href: "/config/equipe", rotulo: "Equipe" },
  { href: "/config/setores", rotulo: "Setores" },
  { href: "/config/estacoes", rotulo: "Estações" },
  { href: "/config/cargos", rotulo: "Cargos" },
  { href: "/config/telas", rotulo: "Telas" },
] as const;
```
> `/config/estacoes` PERMANECE (o quiosque vive lá; não quebrar). Só ADICIONAMOS "Setores".

- [ ] **Step 5: typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: verdes. `/config/setores` no output do build.

- [ ] **Step 6: Commit**

```bash
git add src/app/config/setores/ src/ui/components/app-shell.tsx
git commit -m "feat(setor): tela /config/setores (setores + estações aninhadas + mover) + nav (P-5a fatia 3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `modo=setor` na TV

**Files:**
- Modify: `src/infra/db/schema/enums.ts`, `src/infra/db/schema/tela.ts`
- Create (gerado): `src/infra/db/migrations/00NN_*.sql`
- Modify: `src/domain/os/tela.ts`, `src/domain/os/__tests__/tela.test.ts`
- Modify: `src/application/tela.ts`
- Modify: `src/infra/composition/tela.ts`
- Modify: `src/app/config/telas/{painel-telas.tsx, actions.ts}`

**Interfaces:**
- Consumes: `setor` do schema; `SetorView`/`listarSetoresNoTenant` de `@/infra/composition/setor`.
- Produces: `modo_tela` inclui `setor`; `tela.setorId`; `dadosTv` trata `modo=setor`.

- [ ] **Step 1: enum `modo_tela` += setor + `tela.setor_id`**

Em `src/infra/db/schema/enums.ts`:
```typescript
export const modoTela = pgEnum("modo_tela", ["estacao", "geral", "setor"]);
```
Em `src/infra/db/schema/tela.ts`, adicionar a coluna (após `estacaoId`) + import do `setor`:
```typescript
import { setor } from "./setor";
```
```typescript
  setorId: uuid("setor_id").references(() => setor.id, { onDelete: "set null" }),
```

- [ ] **Step 2: Gerar a migration**

Run: `pnpm drizzle-kit generate`
Expected: cria `00NN` com `ALTER TYPE "modo_tela" ADD VALUE 'setor'` e `ALTER TABLE "tela" ADD COLUMN "setor_id" uuid` + FK. Registrar no journal se o drizzle não fizer. Rodar `pnpm db:migrate` (local).
> Nota Postgres: `ALTER TYPE ... ADD VALUE` não roda dentro de transação em algumas versões. Se `db:migrate` falhar por isso, o drizzle já gera o breakpoint correto; se necessário, separar o ADD VALUE numa migration própria antes do ADD COLUMN.

- [ ] **Step 3: Domínio — `MODOS_TELA` += setor + `validarTela` cresce**

Em `src/domain/os/tela.ts`, atualizar `MODOS_TELA` e `validarTela`:
```typescript
export const MODOS_TELA = ["estacao", "geral", "setor"] as const;
```
E `validarTela` (que hoje recebe `{nome, modo, estacaoId}`) passa a receber `setorId` também:
```typescript
export function validarTela(input: {
  nome: string;
  modo: ModoTela;
  estacaoId: string | null;
  setorId: string | null;
}): void {
  if (!input.nome.trim()) {
    throw new DadosInvalidosError("Dê um nome à tela.");
  }
  if (input.modo === "estacao" && !input.estacaoId) {
    throw new DadosInvalidosError("Escolha a estação que esta tela mostra.");
  }
  if (input.modo === "setor" && !input.setorId) {
    throw new DadosInvalidosError("Escolha o setor que esta tela mostra.");
  }
  if (input.modo === "geral" && (input.estacaoId || input.setorId)) {
    throw new DadosInvalidosError("A visão geral não aponta para estação nem setor.");
  }
  // Coerência cruzada: só o campo do modo é preenchido.
  if (input.modo === "estacao" && input.setorId) {
    throw new DadosInvalidosError("Tela de estação não aponta para setor.");
  }
  if (input.modo === "setor" && input.estacaoId) {
    throw new DadosInvalidosError("Tela de setor não aponta para estação.");
  }
}
```
Atualizar os testes em `src/domain/os/__tests__/tela.test.ts`: as chamadas de `validarTela` agora passam `setorId: null` nos casos existentes; adicionar casos: `modo=setor` sem `setorId` rejeita; com `setorId` aceita; `geral` com `setorId` rejeita.

- [ ] **Step 4: Aplicação `tela.ts` — `setorId` no fluxo**

Em `src/application/tela.ts`: `TelaInput` ganha `setorId: string | null`; `TelaView` ganha `setorId`/`setorNome` (opcional — ao menos `setorId`); `registrarTela`/`configurarTela` gravam `setorId`; `resolverTelaPorToken`/`TelaResolvida` trazem `setorId` além de `estacaoId`. Seguir o padrão exato do `estacaoId` já presente (cada lugar que menciona `estacaoId`, adicionar `setorId` análogo). Passar `setorId` ao `validarTela`.

- [ ] **Step 5: Composição `dadosTv` — filtrar por setor**

Em `src/infra/composition/tela.ts`, `DadosTv` ganha o suporte a setor. Em `modo=setor`, filtrar os cards do `listarPainel` pelas estações do setor. Como o `CardPainel` tem `estacaoId` mas não `setorId`, resolver as estações do setor no tenant da tela e filtrar:
```typescript
  if (resolvida.modo === "setor" && resolvida.setorId) {
    const ctxDb = { tenantId: resolvida.tenantId, usuarioId: "" };
    const estacoesDoSetor = await database.withTenant(resolvida.tenantId, (tx) =>
      tx.select({ id: estacao.id }).from(estacao).where(eq(estacao.setorId, resolvida.setorId!)),
    );
    const ids = new Set(estacoesDoSetor.map((e) => e.id));
    const etapasFiltradas = etapas
      .map((e) => ({ ...e, cards: e.cards.filter((c) => c.estacaoId && ids.has(c.estacaoId)) }))
      .filter((e) => e.cards.length > 0);
    return { tenantId: resolvida.tenantId, modo: resolvida.modo, estacaoId: null, estacaoNome: null, etapas: etapasFiltradas, kpis };
  }
```
(Importar `estacao` do schema e `eq` do drizzle. `DadosTv.modo` já é o tipo do `TelaResolvida["modo"]`, que agora inclui `setor`.)

- [ ] **Step 6: Tela `/config/telas` — opção "Um setor"**

Em `src/app/config/telas/page.tsx`, buscar os setores (`listarSetoresNoTenant`) e passá-los ao painel. Em `painel-telas.tsx`, o seletor de modo ganha a opção `setor` → mostra um `<select>` de setor (como já faz com estação). As actions (`acaoRegistrarTela`/`acaoConfigurarTela`) passam `setorId`. Seguir o padrão do `estacaoId` já existente na tela. `lerModo` (se existir) passa a validar `setor` e a zerar `estacaoId`/`setorId` conforme o modo.

- [ ] **Step 7: Testes + pipeline**

Run: `pnpm test src/domain/os/__tests__/tela.test.ts src/application/__tests__/tela.test.ts` — passam (atualizados com `setorId`). Depois `pnpm typecheck && pnpm lint && pnpm build`.
Expected: verdes. Adicionar, se viável, um caso ao teste de aplicação de tela: registrar tela `modo=setor` com `setorId` e resolver → `TelaResolvida.setorId` correto.

- [ ] **Step 8: Commit**

```bash
git add src/infra/db/schema/enums.ts src/infra/db/schema/tela.ts src/infra/db/migrations/ src/domain/os/tela.ts src/domain/os/__tests__/tela.test.ts src/application/tela.ts src/infra/composition/tela.ts src/app/config/telas/
git commit -m "feat(setor): TV por setor — modo_tela+=setor, tela.setor_id, dadosTv filtra por setor (P-5a fatia 4)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Pipeline + deploy

**Files:** nenhum código novo; conduz o merge e o deploy. (Executada pelo controlador.)

- [ ] **Step 1: Pipeline local completo** — `pnpm typecheck && pnpm lint && pnpm build && pnpm test`. Verde (Docker fora → confiar no CI para DB).
- [ ] **Step 2: Merge + push** — `git checkout main && git merge --no-ff feat/setor-agrupa-estacoes -m "feat(setor): setor agrupando estações + TV por setor (P-5a)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" && git push origin main`.
- [ ] **Step 3: Aguardar CI verde** — `gh run watch $(gh run list --branch main --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`.
- [ ] **Step 4: Migration no cloud** — `railway run --service igni-app pnpm db:migrate`.
- [ ] **Step 5: Verificar no cloud** (script temporário na raiz, removido depois): tabela `setor` existe + RLS `true`/force `false` + policy `setor_tenant_isolation` + grants app_user; `modo_tela` inclui `setor`; `tela.setor_id` existe; **e o crítico: `SELECT count(*) FROM estacao WHERE setor_id IS NULL` = 0** (a migração ligou todas). Rodar via `railway run --service igni-app node verify-setor.mjs`. Remover o script.
- [ ] **Step 6: Deploy** — `railway up --service igni-app --ci`.
- [ ] **Step 7: Smoke** — `curl`: `/login` 200; `/config/setores` 307→/login; `/config/estacoes` 307 (não quebrou); `/config/telas` 307.
- [ ] **Step 8: Docs + branch + memória** — `docs/00_status.md` e `docs/15_backlog_produto.md` (P-5a no ar; P-5b/P-5c seguem); apagar branch; memória `setor-agrupa-estacoes-p5a.md` (dois níveis, migração 1 setor/estação, TV modo=setor, quiosque segue por estação).

---

## Self-review (feito pelo autor do plano)

**1. Cobertura do spec:**
- Tabela `setor` + `estacao.setor_id` + RLS + migração (1 setor/estação, nenhuma órfã) → Task 1. ✓
- Template setores→estações + `criar-oficina` semeia + drift → Task 1. ✓
- `validarSetor` → Task 1; CRUD + moverEstacao + removerSetor bloqueia + listarSetoresComEstacoes → Task 2. ✓
- Tela `/config/setores` (dois níveis, mover, CRUD) + nav → Task 3. ✓
- `modo=setor` na TV (enum+coluna, validarTela cresce, seletor, dadosTv filtra) → Task 4. ✓
- Isolamento A↔B → Tasks 1, 2, 4. ✓
- Deploy + verificar 0 estações sem setor no cloud → Task 5. ✓
- Fora de escopo (P-5b quiosque, P-5c card, drag-drop, reagrupamento auto) → nenhuma task os inclui. ✓

**2. Placeholders:** Sem TBD/TODO de implementação. Os números de migration (00XX/00YY/00ZZ/00NN) são o índice real que o drizzle cria (Task 1 Step 4 e Task 4 Step 2 anotam). O único ponto que pede julgamento do implementer — ajustar `criar-oficina.test.ts` às novas asserções — é explícito (Step 12) porque não dá pra prever o conteúdo exato do teste atual sem quebrar; o implementer roda e corrige o que falhar.

**3. Consistência de tipos:** `SetorView`/`SetorComEstacoes`/`EstacaoDoSetor` definidos na Task 2 e consumidos nas Tasks 3-4; `validarSetor({nome})` idêntico entre domínio (Task 1) e uso (Task 2); `validarTela` com `setorId` uniforme entre Task 4 Step 3 (domínio) e Step 4/6 (aplicação/UI); `moverEstacao(estacaoId, setorId)` consistente entre aplicação (Task 2) e action (Task 3). `SETORES_POR_RAMO`/`setoresDoRamo` (Task 1) consumidos por `criar-oficina` (Task 1 Step 10) e pelo teste de drift (Step 9).

**4. Risco residual (para o revisor):** (a) a Task 4 muda `validarTela` e o fluxo de `tela.ts`, que são do P-3 já no ar — o reviewer deve confirmar que os casos existentes (estacao/geral) seguem passando com o novo parâmetro `setorId`. (b) `ALTER TYPE ADD VALUE` do enum pode exigir migration fora de transação (Task 4 Step 2 nota). (c) Consumidores do template antigo: verificado que só `ramo.ts` (fonte), `criar-oficina.ts` (Step 10) e `ramo.test.ts` (Step 9) usam `estacoesDoRamo`/`ESTACOES_POR_RAMO` — todos cobertos; nenhum órfão. `criar-oficina.test.ts` passa sem edição (asserções genéricas). Nada "descubra ao rodar".
