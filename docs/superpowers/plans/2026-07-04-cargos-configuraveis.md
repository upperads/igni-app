# Cargos Configuráveis por Tenant (P-1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os 4 papéis fixos por **cargos configuráveis por tenant** (nome livre + permissões de um catálogo fixo), semeando os cargos que faltam (Financeiro, Peças/Compras, Pós-venda), sem quebrar ninguém logado em produção.

**Architecture:** Nova tabela `cargo` por tenant (RLS). O catálogo de permissões vive no domínio (código); o cargo guarda quais permissões tem. A migração semeia 7 cargos-semente em cada tenant e liga cada `usuario` ao cargo do seu `papel` atual. O enum `papel` permanece como legado tolerado. `sessaoAtual()` passa a carregar as permissões do cargo; `pode()`/`assertPode()`/`exigeMfa()` passam a operar sobre permissões, não sobre o papel.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Drizzle ORM + Postgres (Supabase), RLS multi-tenant via `withTenant`, Tailwind v4, Vitest.

## Global Constraints

- **TypeScript strict, zero `any`.** Lint estrito (ESLint flat + boundary guard: `src/app` NUNCA importa `@/infra/db/client` nem `db`/`database`).
- **Isolamento multi-tenant sempre** (regra de ouro #7): toda tabela nova tem `tenant_id` + política RLS **na mesma migration**; todo acesso a dados é testado contra vazamento entre tenants (A↔B).
- **Migrations só via Drizzle** (`drizzle-kit generate` → arquivo SQL versionado). Nunca SQL manual em produção. Migration cloud roda via `railway run --service igni-app pnpm db:migrate` (a `DATABASE_URL` do cloud vive nos secrets do Railway; o `.env` local aponta para `127.0.0.1:5442x`).
- **Dinheiro em centavos inteiros** (não relevante aqui, mas é padrão do projeto).
- **SEM Playwright.** Verificação por typecheck/lint/build/test + checagens HTTP (curl).
- **CI verde antes do deploy.** Deploy pela CLI do Railway: `railway up --service igni-app --ci`. Sempre commit/push no GitHub junto.
- **Commits Conventional** por módulo. Toda mensagem de commit termina com:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **O enum `papel` NÃO é removido** nesta leva (legado tolerado). Não editar/apagar migration já aplicada.
- **`cargo:gerir` NÃO entra no catálogo atribuível** — é implícito e exclusivo do cargo Dono.
- **Catálogo de permissões (exato, 10 chaves):** `os:abrir`, `os:editar`, `os:avancar`, `triagem:override`, `orcamento:editar`, `dinheiro:ver`, `dinheiro:ver_peca`, `cadastro:editar`, `equipe:gerir`, `config:editar`.
- **Gatilhos de 2FA (exato):** `equipe:gerir`, `config:editar`, `cargo:gerir`. `dinheiro:ver` e `dinheiro:ver_peca` **NÃO** são gatilho.
- **Permissões-piso do chão (Piso 2, exato):** um cargo `chao=true` não pode ter `orcamento:editar`, `dinheiro:ver` nem `dinheiro:ver_peca`.

---

## Estrutura de arquivos

**Criados:**
- `src/infra/db/schema/cargo.ts` — tabela `cargo` (Drizzle).
- `src/infra/db/migrations/00XX_*.sql` — CREATE TABLE cargo + coluna `usuario.cargo_id` (gerado).
- `src/infra/db/migrations/00YY_rls_cargo.sql` — RLS do cargo (escrito à mão, padrão 0021).
- `src/infra/db/migrations/00ZZ_seed_cargo.sql` — data migration: semeia 7 cargos/tenant + liga usuários (escrito à mão).
- `src/domain/auth/cargo.ts` — catálogo de permissões, `validarCargo`, `exigeMfa(cargo)`, `pode(permissoes, acao)`, cargos-semente canônicos.
- `src/domain/auth/__tests__/cargo.test.ts` — testes do domínio (4 pisos, exigeMfa, pode, drift).
- `src/application/cargo.ts` — casos de uso (listar/criar/editar/renomear + resolver permissões + último Dono).
- `src/application/__tests__/cargo.test.ts` — testes de aplicação (isolamento A↔B, último Dono).
- `src/infra/composition/cargo.ts` — wrappers `*NoTenant`.
- `src/infra/db/__tests__/cargo-isolation.test.ts` — isolamento RLS A↔B.
- `src/app/config/cargos/page.tsx` — tela de gestão de cargos.
- `src/app/config/cargos/editor-cargos.tsx` — client component (matriz de permissões + pisos ao vivo).
- `src/app/config/cargos/actions.ts` — server actions (RBAC no boundary).

**Modificados:**
- `src/infra/db/schema/usuario.ts` — adiciona `cargoId`.
- `src/infra/db/schema/index.ts` — exporta `cargo`.
- `src/domain/auth/rbac.ts` — `pode`/`assertPode` passam a receber permissões (mantém compat de tipos).
- `src/infra/auth/perfil-repo.ts` — resolve `cargoId` + permissões do cargo.
- `src/infra/auth/sessao.ts` — `SessaoUsuario` ganha `permissoes` + `exige2fa`.
- `src/app/config/equipe/painel-equipe.tsx` + `actions.ts` + `page.tsx` — seletor de cargo; último Dono.
- `src/application/equipe.ts` — `mudarCargo`/último-Dono; `requires_mfa` derivado do cargo.
- `src/application/login.ts` — `exigeMfa` do cargo.
- Consumidores de `pode(sessao.papel, …)`: `src/ui/components/app-shell.tsx`, `src/app/page.tsx`, `src/app/relatorio/page.tsx`, `src/app/os/[id]/page.tsx`, `src/app/os/actions.ts`, `src/app/servicos/page.tsx` + `actions.ts`, `src/app/config/estacoes/{page,actions}.ts`, `src/app/config/demonstracao/actions.ts`, `src/app/config/equipe/{page,actions}.ts`.

---

## Task 1: Schema `cargo` + `usuario.cargo_id` + RLS + seed migration + isolamento

**Files:**
- Create: `src/infra/db/schema/cargo.ts`
- Modify: `src/infra/db/schema/usuario.ts`
- Modify: `src/infra/db/schema/index.ts`
- Create (gerado): `src/infra/db/migrations/00XX_*.sql`
- Create (à mão): `src/infra/db/migrations/00YY_rls_cargo.sql`
- Create (à mão): `src/infra/db/migrations/00ZZ_seed_cargo.sql`
- Test: `src/infra/db/__tests__/cargo-isolation.test.ts`

**Interfaces:**
- Produces: tabela `cargo` (Drizzle export `cargo`) com colunas `id, tenantId, nome, sistema, chao, permissoes (text[]), exige2fa, createdAt`; `usuario.cargoId` (uuid nullable → cargo.id).

- [ ] **Step 1: Escrever o schema da tabela `cargo`**

`src/infra/db/schema/cargo.ts`:
```typescript
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenant } from "./tenant";

/**
 * Cargo (P-1): função da pessoa na oficina, configurável por tenant. `nome` é livre; `permissoes`
 * são chaves de um CATÁLOGO FIXO que o domínio (`domain/auth/cargo.ts`) sabe fazer valer. Cargos
 * `sistema` são semeados e têm permissões travadas (nome editável). `chao=true` = cargo de quiosque
 * (não vê dinheiro). `exige2fa` é piso: um gatilho força true, o dono nunca rebaixa. RLS por tenant.
 */
export const cargo = pgTable("cargo", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  sistema: boolean("sistema").notNull().default(false),
  chao: boolean("chao").notNull().default(false),
  permissoes: text("permissoes").array().notNull().default([]),
  exige2fa: boolean("exige_2fa").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Adicionar `cargoId` ao usuario**

Em `src/infra/db/schema/usuario.ts`, dentro do objeto de colunas (após `pinHash`), adicionar:
```typescript
    // Cargo (P-1): a função da pessoa, fonte de verdade do RBAC. Nulo só transitório na migração;
    // ao fim todo usuário tem cargo. FK por tenant (o seed liga cada usuário ao cargo do seu papel).
    cargoId: uuid("cargo_id").references((): import("drizzle-orm/pg-core").AnyPgColumn => cargo.id),
```
E adicionar o import no topo do arquivo:
```typescript
import { cargo } from "./cargo";
```
> Nota: usar `references(() => cargo.id)` normal; o cast acima só se o TS reclamar de referência circular. Se `usuario.ts` e `cargo.ts` não se referenciam mutuamente (cargo não referencia usuario), o import simples basta:
> ```typescript
> cargoId: uuid("cargo_id").references(() => cargo.id),
> ```

- [ ] **Step 3: Exportar `cargo` no barrel**

Em `src/infra/db/schema/index.ts`, adicionar a linha de re-export no lugar alfabético/lógico (junto das outras tabelas):
```typescript
export * from "./cargo";
```

- [ ] **Step 4: Gerar a migration do schema**

Run: `pnpm drizzle-kit generate`
Expected: cria um arquivo `src/infra/db/migrations/00XX_<nome>.sql` com `CREATE TABLE "cargo" (...)`, o FK `cargo_tenant_id_tenant_id_fk`, e o `ALTER TABLE "usuario" ADD COLUMN "cargo_id" uuid` + FK `usuario_cargo_id_cargo_id_fk`. Anote o número `00XX` gerado e o próximo índice livre para os passos 5 e 6.

Verifique o SQL gerado (deve conter, entre outros):
```sql
CREATE TABLE "cargo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"sistema" boolean DEFAULT false NOT NULL,
	"chao" boolean DEFAULT false NOT NULL,
	"permissoes" text[] DEFAULT '{}' NOT NULL,
	"exige_2fa" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

- [ ] **Step 5: Escrever a migration de RLS do cargo (à mão)**

Crie `src/infra/db/migrations/00YY_rls_cargo.sql` (00YY = próximo índice livre após 00XX). Conteúdo:
```sql
-- RLS multi-tenant dos cargos (P-1). Mesmo padrão do 0021_rls_servico:
-- GRANT ao app_user + ENABLE (SEM FORCE) + política de isolamento por tenant.
-- `app_user` já existe (migration 0001).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "cargo" TO app_user;--> statement-breakpoint

ALTER TABLE "cargo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY cargo_tenant_isolation ON "cargo"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
```

- [ ] **Step 6: Escrever a migration de SEED por tenant (à mão)**

Crie `src/infra/db/migrations/00ZZ_seed_cargo.sql` (00ZZ = índice após 00YY). Semeia os 7 cargos-semente em cada tenant existente e liga cada usuário ao cargo do seu papel. Conteúdo:
```sql
-- Seed dos cargos-semente (P-1): para CADA tenant existente, cria os 7 cargos de sistema e liga
-- cada usuário ao cargo correspondente ao seu papel atual. Idempotência não é necessária (migration
-- roda uma vez), mas o WHERE NOT EXISTS protege contra reexecução acidental em dev.

-- Dono: todas as permissões atribuíveis + cargo:gerir é implícito (não listado aqui). exige_2fa.
INSERT INTO "cargo" (tenant_id, nome, sistema, chao, permissoes, exige_2fa)
SELECT t.id, 'Dono', true, false,
  ARRAY['os:abrir','os:editar','os:avancar','triagem:override','orcamento:editar','dinheiro:ver','dinheiro:ver_peca','cadastro:editar','equipe:gerir','config:editar'],
  true
FROM "tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "cargo" c WHERE c.tenant_id = t.id AND c.nome = 'Dono');--> statement-breakpoint

INSERT INTO "cargo" (tenant_id, nome, sistema, chao, permissoes, exige_2fa)
SELECT t.id, 'Gestor', true, false,
  ARRAY['os:abrir','os:editar','os:avancar','triagem:override','orcamento:editar','dinheiro:ver','dinheiro:ver_peca','cadastro:editar','equipe:gerir','config:editar'],
  true
FROM "tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "cargo" c WHERE c.tenant_id = t.id AND c.nome = 'Gestor');--> statement-breakpoint

INSERT INTO "cargo" (tenant_id, nome, sistema, chao, permissoes, exige_2fa)
SELECT t.id, 'Recepção', true, false,
  ARRAY['os:abrir','os:editar','os:avancar','orcamento:editar','dinheiro:ver','cadastro:editar','triagem:override'],
  false
FROM "tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "cargo" c WHERE c.tenant_id = t.id AND c.nome = 'Recepção');--> statement-breakpoint

INSERT INTO "cargo" (tenant_id, nome, sistema, chao, permissoes, exige_2fa)
SELECT t.id, 'Produção', true, true,
  ARRAY['os:avancar'],
  false
FROM "tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "cargo" c WHERE c.tenant_id = t.id AND c.nome = 'Produção');--> statement-breakpoint

INSERT INTO "cargo" (tenant_id, nome, sistema, chao, permissoes, exige_2fa)
SELECT t.id, 'Financeiro', true, false,
  ARRAY['dinheiro:ver','orcamento:editar','os:editar'],
  true
FROM "tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "cargo" c WHERE c.tenant_id = t.id AND c.nome = 'Financeiro');--> statement-breakpoint

INSERT INTO "cargo" (tenant_id, nome, sistema, chao, permissoes, exige_2fa)
SELECT t.id, 'Peças/Compras', true, false,
  ARRAY['dinheiro:ver_peca','os:avancar'],
  false
FROM "tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "cargo" c WHERE c.tenant_id = t.id AND c.nome = 'Peças/Compras');--> statement-breakpoint

INSERT INTO "cargo" (tenant_id, nome, sistema, chao, permissoes, exige_2fa)
SELECT t.id, 'Pós-venda', true, false,
  ARRAY['os:avancar','cadastro:editar'],
  false
FROM "tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "cargo" c WHERE c.tenant_id = t.id AND c.nome = 'Pós-venda');--> statement-breakpoint

-- Liga cada usuário ao cargo-semente correspondente ao seu papel atual (só onde ainda não ligado).
UPDATE "usuario" u SET cargo_id = c.id
FROM "cargo" c
WHERE c.tenant_id = u.tenant_id
  AND u.cargo_id IS NULL
  AND ( (u.papel = 'dono' AND c.nome = 'Dono')
     OR (u.papel = 'gestor' AND c.nome = 'Gestor')
     OR (u.papel = 'recepcao' AND c.nome = 'Recepção')
     OR (u.papel = 'producao' AND c.nome = 'Produção') );
```

- [ ] **Step 7: Registrar as migrations manuais no journal do drizzle**

Abra `src/infra/db/migrations/meta/_journal.json`. As migrations manuais (00YY, 00ZZ) precisam de entradas no `entries` para `drizzle-kit migrate` aplicá-las. Copie o formato das entradas existentes (idx incremental, `version`, `when` como número — use o mesmo `when` da entrada 00XX gerada + 1 e +2 para manter ordem, ou copie de uma entrada vizinha), `tag` = nome do arquivo sem `.sql`, `breakpoints: true`. Verifique olhando como 0019/0021 (RLS manuais anteriores) estão registrados no journal e replique exatamente esse padrão para 00YY e 00ZZ.

Run: `pnpm db:migrate` (aplica no banco LOCAL do `.env`)
Expected: aplica 00XX, 00YY, 00ZZ sem erro; "migrations applied successfully".

- [ ] **Step 8: Escrever o teste de isolamento (RED)**

`src/infra/db/__tests__/cargo-isolation.test.ts`:
```typescript
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/infra/db/connection";
import { cargo, tenant } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

/** Isolamento RLS da tabela cargo (regra de ouro #7): A nunca vê/toca os cargos de B. */
describe("isolamento multi-tenant — cargo (RLS)", () => {
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
    await database.db.delete(cargo);
    await database.db.delete(tenant);
    const [a] = await database.db
      .insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db
      .insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    tenantA = a!.id;
    tenantB = b!.id;
  });

  it("A enxerga apenas os próprios cargos", async () => {
    await database.db.insert(cargo).values({ tenantId: tenantA, nome: "Financeiro", permissoes: ["dinheiro:ver"] });
    await database.db.insert(cargo).values({ tenantId: tenantB, nome: "Compras", permissoes: ["os:avancar"] });

    const vistos = await database.withTenant(tenantA, (tx) => tx.select().from(cargo));
    expect(vistos).toHaveLength(1);
    expect(vistos[0]!.nome).toBe("Financeiro");

    const deB = await database.withTenant(tenantA, (tx) =>
      tx.select().from(cargo).where(eq(cargo.nome, "Compras")),
    );
    expect(deB).toHaveLength(0);
  });

  it("a RLS barra ESCREVER um cargo marcado como de outro tenant (WITH CHECK)", async () => {
    await expect(
      database.withTenant(tenantA, (tx) =>
        tx.insert(cargo).values({ tenantId: tenantB, nome: "Intruso", permissoes: [] }),
      ),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 9: Rodar o teste de isolamento (verde)**

Run: `pnpm test src/infra/db/__tests__/cargo-isolation.test.ts`
Expected: 2/2 PASS. (Se o Docker de teste estiver fora, confiar no CI — é o padrão do projeto.)

- [ ] **Step 10: typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: todos verdes (a coluna `permissoes: text[]` e `cargoId` tipam; boundary guard ok).

- [ ] **Step 11: Commit**

```bash
git add src/infra/db/schema/cargo.ts src/infra/db/schema/usuario.ts src/infra/db/schema/index.ts src/infra/db/migrations/ src/infra/db/__tests__/cargo-isolation.test.ts
git commit -m "feat(cargo): schema do cargo + RLS + seed por tenant (P-1 fatia 1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Domínio dos cargos (catálogo, validarCargo, exigeMfa, pode)

**Files:**
- Create: `src/domain/auth/cargo.ts`
- Create: `src/domain/auth/__tests__/cargo.test.ts`

**Interfaces:**
- Consumes: nada (domínio puro).
- Produces:
  - `PERMISSOES: readonly Permissao[]` — as 10 chaves do catálogo.
  - `type Permissao` (união das 10 chaves).
  - `type CargoBase = { chao: boolean; exige2fa: boolean; permissoes: readonly string[] }`.
  - `validarCargo(input: { nome: string; chao: boolean; permissoes: readonly string[] }): void` — lança `DadosInvalidosError` se violar Piso 2 ou tiver permissão fora do catálogo ou nome vazio.
  - `exigeMfa(cargo: CargoBase): boolean` — `cargo.exige2fa || temGatilho2fa(cargo.permissoes)`.
  - `pode(permissoes: readonly string[], acao: Permissao): boolean`.
  - `CARGOS_SEMENTE: readonly SementeCargo[]` — os 7 cargos canônicos (nome, sistema, chao, exige2fa, permissoes), fonte única espelhada pelo seed SQL.

- [ ] **Step 1: Escrever os testes do domínio (RED)**

`src/domain/auth/__tests__/cargo.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import {
  CARGOS_SEMENTE,
  exigeMfa,
  PERMISSOES,
  pode,
  validarCargo,
} from "@/domain/auth/cargo";
import { DadosInvalidosError } from "@/domain/shared/errors";

describe("cargo — catálogo e pode()", () => {
  it("o catálogo tem exatamente as 10 chaves esperadas", () => {
    expect([...PERMISSOES].sort()).toEqual(
      [
        "cadastro:editar", "config:editar", "dinheiro:ver", "dinheiro:ver_peca",
        "equipe:gerir", "orcamento:editar", "os:abrir", "os:avancar", "os:editar",
        "triagem:override",
      ].sort(),
    );
  });

  it("pode() confere presença da permissão", () => {
    expect(pode(["os:avancar"], "os:avancar")).toBe(true);
    expect(pode(["os:avancar"], "orcamento:editar")).toBe(false);
  });
});

describe("cargo — validarCargo (pisos 2 e catálogo)", () => {
  it("Piso 2: cargo de chão NÃO pode ver dinheiro nem editar orçamento", () => {
    expect(() => validarCargo({ nome: "Chão X", chao: true, permissoes: ["dinheiro:ver"] })).toThrow(DadosInvalidosError);
    expect(() => validarCargo({ nome: "Chão X", chao: true, permissoes: ["dinheiro:ver_peca"] })).toThrow(DadosInvalidosError);
    expect(() => validarCargo({ nome: "Chão X", chao: true, permissoes: ["orcamento:editar"] })).toThrow(DadosInvalidosError);
    expect(() => validarCargo({ nome: "Chão X", chao: true, permissoes: ["os:avancar"] })).not.toThrow();
  });

  it("rejeita permissão fora do catálogo (incl. cargo:gerir, que não é atribuível)", () => {
    expect(() => validarCargo({ nome: "X", chao: false, permissoes: ["cargo:gerir"] })).toThrow(DadosInvalidosError);
    expect(() => validarCargo({ nome: "X", chao: false, permissoes: ["inventada"] })).toThrow(DadosInvalidosError);
  });

  it("rejeita nome vazio", () => {
    expect(() => validarCargo({ nome: "   ", chao: false, permissoes: [] })).toThrow(DadosInvalidosError);
  });
});

describe("cargo — exigeMfa (Piso 3: piso, nunca teto)", () => {
  it("flag próprio força 2FA", () => {
    expect(exigeMfa({ chao: false, exige2fa: true, permissoes: [] })).toBe(true);
  });

  it("permissão-gatilho força 2FA mesmo com flag false", () => {
    expect(exigeMfa({ chao: false, exige2fa: false, permissoes: ["equipe:gerir"] })).toBe(true);
    expect(exigeMfa({ chao: false, exige2fa: false, permissoes: ["config:editar"] })).toBe(true);
  });

  it("dinheiro:ver NÃO é gatilho (recepção fica sem 2FA)", () => {
    expect(exigeMfa({ chao: false, exige2fa: false, permissoes: ["dinheiro:ver", "orcamento:editar", "cadastro:editar"] })).toBe(false);
    expect(exigeMfa({ chao: false, exige2fa: false, permissoes: ["dinheiro:ver_peca"] })).toBe(false);
  });
});

describe("cargo — cargos-semente canônicos", () => {
  it("são 7 e batem com o esperado (fonte única do seed SQL)", () => {
    const nomes = CARGOS_SEMENTE.map((c) => c.nome).sort();
    expect(nomes).toEqual(["Dono", "Financeiro", "Gestor", "Peças/Compras", "Produção", "Pós-venda", "Recepção"].sort());
  });

  it("cada semente respeita seus próprios pisos (chão sem dinheiro; exige2fa coerente com exigeMfa)", () => {
    for (const c of CARGOS_SEMENTE) {
      expect(() => validarCargo({ nome: c.nome, chao: c.chao, permissoes: c.permissoes })).not.toThrow();
      // exige2fa registrado nunca é menor que o piso derivado das permissões
      if (exigeMfa({ chao: c.chao, exige2fa: false, permissoes: c.permissoes })) {
        expect(c.exige2fa).toBe(true);
      }
    }
  });

  it("Recepção vê dinheiro mas NÃO exige 2FA; Financeiro exige", () => {
    const recep = CARGOS_SEMENTE.find((c) => c.nome === "Recepção")!;
    const fin = CARGOS_SEMENTE.find((c) => c.nome === "Financeiro")!;
    expect(recep.permissoes).toContain("dinheiro:ver");
    expect(exigeMfa({ chao: recep.chao, exige2fa: recep.exige2fa, permissoes: recep.permissoes })).toBe(false);
    expect(exigeMfa({ chao: fin.chao, exige2fa: fin.exige2fa, permissoes: fin.permissoes })).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes (verificar que falham)**

Run: `pnpm test src/domain/auth/__tests__/cargo.test.ts`
Expected: FAIL (módulo `@/domain/auth/cargo` não existe).

- [ ] **Step 3: Escrever o domínio**

`src/domain/auth/cargo.ts`:
```typescript
import { DadosInvalidosError } from "@/domain/shared/errors";

/**
 * Cargos (P-1): o catálogo FIXO de permissões e as regras (pisos) que nenhuma configuração viola.
 * Lógica pura. O banco (`schema/cargo`) guarda o cargo; aqui vive o que cada permissão significa.
 * `cargo:gerir` NÃO está no catálogo atribuível — é implícito e exclusivo do cargo Dono.
 */
export const PERMISSOES = [
  "os:abrir",
  "os:editar",
  "os:avancar",
  "triagem:override",
  "orcamento:editar",
  "dinheiro:ver",
  "dinheiro:ver_peca",
  "cadastro:editar",
  "equipe:gerir",
  "config:editar",
] as const;

export type Permissao = (typeof PERMISSOES)[number];

/** Permissões que um cargo de chão (quiosque) NUNCA pode ter (Piso 2 — regra de ouro). */
const PROIBIDAS_NO_CHAO: readonly Permissao[] = ["orcamento:editar", "dinheiro:ver", "dinheiro:ver_peca"];

/** Permissões que FORÇAM 2FA (Piso 3). dinheiro:ver NÃO está aqui de propósito. */
const GATILHOS_2FA: readonly string[] = ["equipe:gerir", "config:editar", "cargo:gerir"];

export interface CargoBase {
  chao: boolean;
  exige2fa: boolean;
  permissoes: readonly string[];
}

function ehPermissaoValida(p: string): p is Permissao {
  return (PERMISSOES as readonly string[]).includes(p);
}

/** Valida um cargo à luz do catálogo e dos pisos. Lança DadosInvalidosError. */
export function validarCargo(input: { nome: string; chao: boolean; permissoes: readonly string[] }): void {
  if (!input.nome.trim()) {
    throw new DadosInvalidosError("Dê um nome ao cargo.");
  }
  for (const p of input.permissoes) {
    if (!ehPermissaoValida(p)) {
      throw new DadosInvalidosError(`Permissão desconhecida: ${p}.`);
    }
  }
  if (input.chao) {
    for (const p of PROIBIDAS_NO_CHAO) {
      if (input.permissoes.includes(p)) {
        throw new DadosInvalidosError("Cargo de chão não pode ver valores nem editar orçamento.");
      }
    }
  }
}

/** 2FA é piso, nunca teto: o flag do cargo OU qualquer permissão-gatilho força 2FA. */
export function exigeMfa(cargo: CargoBase): boolean {
  return cargo.exige2fa || cargo.permissoes.some((p) => GATILHOS_2FA.includes(p));
}

/** RBAC: o cargo pode a ação se a permissão está no seu conjunto. */
export function pode(permissoes: readonly string[], acao: Permissao): boolean {
  return permissoes.includes(acao);
}

export interface SementeCargo {
  nome: string;
  sistema: true;
  chao: boolean;
  exige2fa: boolean;
  permissoes: readonly Permissao[];
}

/**
 * Os 7 cargos-semente canônicos. FONTE ÚNICA — o seed SQL (migration) espelha isto; o teste de
 * drift garante que não divergem. Ordem = ordem de exibição sugerida.
 */
export const CARGOS_SEMENTE: readonly SementeCargo[] = [
  { nome: "Dono", sistema: true, chao: false, exige2fa: true,
    permissoes: ["os:abrir", "os:editar", "os:avancar", "triagem:override", "orcamento:editar", "dinheiro:ver", "dinheiro:ver_peca", "cadastro:editar", "equipe:gerir", "config:editar"] },
  { nome: "Gestor", sistema: true, chao: false, exige2fa: true,
    permissoes: ["os:abrir", "os:editar", "os:avancar", "triagem:override", "orcamento:editar", "dinheiro:ver", "dinheiro:ver_peca", "cadastro:editar", "equipe:gerir", "config:editar"] },
  { nome: "Recepção", sistema: true, chao: false, exige2fa: false,
    permissoes: ["os:abrir", "os:editar", "os:avancar", "orcamento:editar", "dinheiro:ver", "cadastro:editar", "triagem:override"] },
  { nome: "Produção", sistema: true, chao: true, exige2fa: false,
    permissoes: ["os:avancar"] },
  { nome: "Financeiro", sistema: true, chao: false, exige2fa: true,
    permissoes: ["dinheiro:ver", "orcamento:editar", "os:editar"] },
  { nome: "Peças/Compras", sistema: true, chao: false, exige2fa: false,
    permissoes: ["dinheiro:ver_peca", "os:avancar"] },
  { nome: "Pós-venda", sistema: true, chao: false, exige2fa: false,
    permissoes: ["os:avancar", "cadastro:editar"] },
];
```

- [ ] **Step 4: Rodar os testes (verde)**

Run: `pnpm test src/domain/auth/__tests__/cargo.test.ts`
Expected: todos PASS.

- [ ] **Step 5: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: verdes.

- [ ] **Step 6: Commit**

```bash
git add src/domain/auth/cargo.ts src/domain/auth/__tests__/cargo.test.ts
git commit -m "feat(cargo): domínio puro — catálogo, pisos, exigeMfa, pode (P-1 fatia 2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Aplicação + composição (CRUD de cargos, resolver permissões, último Dono)

**Files:**
- Create: `src/application/cargo.ts`
- Create: `src/application/__tests__/cargo.test.ts`
- Create: `src/infra/composition/cargo.ts`

**Interfaces:**
- Consumes: `validarCargo`, `CARGOS_SEMENTE`, `type Permissao` de `@/domain/auth/cargo`; `Database`, `withTenant`; `cargo`, `usuario` do schema; `SessaoTenant` de `@/application/abrir-os`.
- Produces:
  - `CargoView = { id: string; nome: string; sistema: boolean; chao: boolean; exige2fa: boolean; permissoes: Permissao[] }`.
  - `listarCargos(database, sessao): Promise<CargoView[]>`.
  - `criarCargo(database, sessao, input: { nome; chao; permissoes; exige2fa }): Promise<{ id }>`.
  - `editarCargo(database, sessao, id, input): Promise<void>` — bloqueia editar permissões de cargo `sistema` (só nome/exige2fa quando permitido).
  - `renomearCargo(database, sessao, id, nome): Promise<void>`.
  - `excluirCargo(database, sessao, id): Promise<void>` — bloqueia excluir cargo `sistema`.
  - `contarUsuariosComCargoDono(database, sessao): Promise<number>` — suporte ao "último Dono" (usado na fatia 5).

- [ ] **Step 1: Escrever os testes de aplicação (RED)**

`src/application/__tests__/cargo.test.ts`:
```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarCargo, editarCargo, excluirCargo, listarCargos } from "@/application/cargo";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { cargo, tenant } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

describe("aplicação — cargo (isolado por tenant)", () => {
  let database: Database;
  let tenantA: string;
  let tenantB: string;
  const sessaoA = () => ({ tenantId: tenantA, usuarioId: "x" });
  const sessaoB = () => ({ tenantId: tenantB, usuarioId: "y" });

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });
  afterAll(async () => {
    await database.close();
  });
  beforeEach(async () => {
    await database.db.delete(cargo);
    await database.db.delete(tenant);
    const [a] = await database.db.insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db.insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    tenantA = a!.id;
    tenantB = b!.id;
  });

  it("cria e lista só os do próprio tenant", async () => {
    await criarCargo(database, sessaoA(), { nome: "Financeiro", chao: false, exige2fa: true, permissoes: ["dinheiro:ver"] });
    await criarCargo(database, sessaoB(), { nome: "Outro", chao: false, exige2fa: false, permissoes: ["os:avancar"] });
    const a = await listarCargos(database, sessaoA());
    expect(a).toHaveLength(1);
    expect(a[0]!.nome).toBe("Financeiro");
  });

  it("REJEITA criar cargo de chão com permissão de dinheiro (Piso 2)", async () => {
    await expect(
      criarCargo(database, sessaoA(), { nome: "Chão", chao: true, exige2fa: false, permissoes: ["dinheiro:ver"] }),
    ).rejects.toThrow(DadosInvalidosError);
  });

  it("NÃO permite editar permissões de cargo de sistema", async () => {
    const [semente] = await database.db.insert(cargo).values({
      tenantId: tenantA, nome: "Recepção", sistema: true, chao: false, exige2fa: false, permissoes: ["os:abrir"],
    }).returning();
    await expect(
      editarCargo(database, sessaoA(), semente!.id, { nome: "Recepção", chao: false, exige2fa: false, permissoes: ["config:editar"] }),
    ).rejects.toThrow(DadosInvalidosError);
  });

  it("NÃO permite excluir cargo de sistema", async () => {
    const [semente] = await database.db.insert(cargo).values({
      tenantId: tenantA, nome: "Dono", sistema: true, chao: false, exige2fa: true, permissoes: ["config:editar"],
    }).returning();
    await expect(excluirCargo(database, sessaoA(), semente!.id)).rejects.toThrow(DadosInvalidosError);
  });
});
```

- [ ] **Step 2: Rodar (RED)**

Run: `pnpm test src/application/__tests__/cargo.test.ts`
Expected: FAIL (`@/application/cargo` não existe).

- [ ] **Step 3: Escrever a aplicação**

`src/application/cargo.ts`:
```typescript
import { asc, eq, sql } from "drizzle-orm";
import { type Permissao, validarCargo } from "@/domain/auth/cargo";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { cargo, usuario } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/**
 * Cargos (P-1): CRUD escopado ao tenant (`withTenant` → RLS). Cargos de sistema têm permissões
 * travadas (só nome/exige2fa mudam, e mesmo assim o gatilho de 2FA manda). Validação de domínio
 * (`validarCargo`) roda ANTES do withTenant — o throw vira rejeição de Promise (contrato uniforme).
 */
export interface CargoView {
  id: string;
  nome: string;
  sistema: boolean;
  chao: boolean;
  exige2fa: boolean;
  permissoes: Permissao[];
}

export interface CargoInput {
  nome: string;
  chao: boolean;
  exige2fa: boolean;
  permissoes: Permissao[];
}

export function listarCargos(database: Database, sessao: SessaoTenant): Promise<CargoView[]> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const linhas = await tx
      .select({
        id: cargo.id, nome: cargo.nome, sistema: cargo.sistema,
        chao: cargo.chao, exige2fa: cargo.exige2fa, permissoes: cargo.permissoes,
      })
      .from(cargo)
      .orderBy(asc(cargo.nome));
    return linhas.map((l) => ({ ...l, permissoes: l.permissoes as Permissao[] }));
  });
}

export async function criarCargo(
  database: Database,
  sessao: SessaoTenant,
  input: CargoInput,
): Promise<{ id: string }> {
  validarCargo(input);
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [novo] = await tx
      .insert(cargo)
      .values({
        tenantId: sessao.tenantId,
        nome: input.nome.trim(),
        sistema: false,
        chao: input.chao,
        exige2fa: input.exige2fa,
        permissoes: input.permissoes,
      })
      .returning({ id: cargo.id });
    return { id: novo!.id };
  });
}

export async function editarCargo(
  database: Database,
  sessao: SessaoTenant,
  id: string,
  input: CargoInput,
): Promise<void> {
  validarCargo(input);
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [alvo] = await tx.select({ sistema: cargo.sistema }).from(cargo).where(eq(cargo.id, id)).limit(1);
    if (!alvo) {
      throw new DadosInvalidosError("Cargo não encontrado.");
    }
    if (alvo.sistema) {
      throw new DadosInvalidosError("Cargo de sistema tem permissões fixas — só o nome pode mudar.");
    }
    await tx
      .update(cargo)
      .set({ nome: input.nome.trim(), chao: input.chao, exige2fa: input.exige2fa, permissoes: input.permissoes })
      .where(eq(cargo.id, id));
  });
}

/** Renomear vale para qualquer cargo (inclusive de sistema — só o nome). */
export async function renomearCargo(
  database: Database,
  sessao: SessaoTenant,
  id: string,
  nome: string,
): Promise<void> {
  if (!nome.trim()) {
    throw new DadosInvalidosError("Dê um nome ao cargo.");
  }
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx.update(cargo).set({ nome: nome.trim() }).where(eq(cargo.id, id));
  });
}

export async function excluirCargo(database: Database, sessao: SessaoTenant, id: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [alvo] = await tx.select({ sistema: cargo.sistema }).from(cargo).where(eq(cargo.id, id)).limit(1);
    if (!alvo) {
      throw new DadosInvalidosError("Cargo não encontrado.");
    }
    if (alvo.sistema) {
      throw new DadosInvalidosError("Cargo de sistema não pode ser excluído.");
    }
    await tx.delete(cargo).where(eq(cargo.id, id));
  });
}

/** Quantos usuários ATIVOS têm o cargo Dono (suporte ao "último Dono" — Piso 1). */
export function contarUsuariosComCargoDono(database: Database, sessao: SessaoTenant): Promise<number> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [row] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(usuario)
      .innerJoin(cargo, eq(cargo.id, usuario.cargoId))
      .where(sql`${cargo.nome} = 'Dono' AND ${usuario.desativadoEm} IS NULL`);
    return row?.n ?? 0;
  });
}
```

- [ ] **Step 4: Rodar (verde)**

Run: `pnpm test src/application/__tests__/cargo.test.ts`
Expected: 4/4 PASS.

- [ ] **Step 5: Escrever a composição**

`src/infra/composition/cargo.ts`:
```typescript
import type { SessaoTenant } from "@/application/abrir-os";
import {
  type CargoInput,
  type CargoView,
  contarUsuariosComCargoDono,
  criarCargo,
  editarCargo,
  excluirCargo,
  listarCargos,
  renomearCargo,
} from "@/application/cargo";
import { database } from "@/infra/db/client";

/** Composição dos cargos (P-1): liga os casos de uso ao tenant corrente. A web importa daqui. */
export type { CargoView, CargoInput };

export function listarCargosNoTenant(sessao: SessaoTenant): Promise<CargoView[]> {
  return listarCargos(database, sessao);
}
export function criarCargoNoTenant(sessao: SessaoTenant, input: CargoInput): Promise<{ id: string }> {
  return criarCargo(database, sessao, input);
}
export function editarCargoNoTenant(sessao: SessaoTenant, id: string, input: CargoInput): Promise<void> {
  return editarCargo(database, sessao, id, input);
}
export function renomearCargoNoTenant(sessao: SessaoTenant, id: string, nome: string): Promise<void> {
  return renomearCargo(database, sessao, id, nome);
}
export function excluirCargoNoTenant(sessao: SessaoTenant, id: string): Promise<void> {
  return excluirCargo(database, sessao, id);
}
export function contarDonosNoTenant(sessao: SessaoTenant): Promise<number> {
  return contarUsuariosComCargoDono(database, sessao);
}
```

- [ ] **Step 6: typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: verdes.

- [ ] **Step 7: Commit**

```bash
git add src/application/cargo.ts src/application/__tests__/cargo.test.ts src/infra/composition/cargo.ts
git commit -m "feat(cargo): aplicação — CRUD isolado por tenant + último Dono (P-1 fatia 3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Enriquecer a sessão com permissões do cargo

> **Por que antes da tela:** a tela `/config/cargos` (Task 5) e todos os consumidores de RBAC leem `sessao.permissoes`. Este passo cria esse campo lendo o cargo do usuário, ANTES de qualquer consumidor mudar. Depois desta task, `sessao.papel` e `sessao.permissoes` coexistem (o `papel` ainda é usado pelos consumidores antigos até a Task 6) — nada quebra: só ADICIONAMOS campos à sessão.

**Files:**
- Modify: `src/infra/auth/perfil-repo.ts`
- Modify: `src/infra/auth/sessao.ts`

**Interfaces:**
- Consumes: `exigeMfa`, `type Permissao` de `@/domain/auth/cargo`; tabela `cargo`.
- Produces: `SessaoUsuario` ganha `cargoNome: string`, `permissoes: Permissao[]`, `exige2fa: boolean`, `podeGerirCargos: boolean` (todos NOVOS; `papel` permanece).

- [ ] **Step 1: `perfil-repo.ts` resolve o cargo + permissões**

Substituir `src/infra/auth/perfil-repo.ts` por (junta `cargo` via leftJoin, mantém `papel` legado):
```typescript
import { and, eq, isNull } from "drizzle-orm";
import type { Permissao } from "@/domain/auth/cargo";
import type { Papel } from "@/domain/auth/papel";
import type { AppDatabase } from "@/infra/db/connection";
import { cargo, tenant, usuario } from "@/infra/db/schema";

export interface PerfilUsuario {
  usuarioId: string;
  tenantId: string;
  papel: Papel;
  tenantNome: string;
  cargoNome: string;
  permissoes: Permissao[];
  exige2fa: boolean;
}

/**
 * Resolve o perfil da app a partir da identidade autenticada. Agora traz o CARGO (nome, permissões,
 * flag 2FA) — fonte de verdade do RBAC (P-1). `papel` permanece (legado). Membro desativado não
 * resolve (I1). leftJoin no cargo: usuário sem cargo (transitório) resolve com permissões vazias.
 */
export async function resolverPerfilPorAuthUserId(
  db: AppDatabase,
  authUserId: string,
): Promise<PerfilUsuario | null> {
  const [row] = await db
    .select({
      usuarioId: usuario.id,
      tenantId: usuario.tenantId,
      papel: usuario.papel,
      tenantNome: tenant.nome,
      cargoNome: cargo.nome,
      permissoes: cargo.permissoes,
      exige2faFlag: cargo.exige2fa,
    })
    .from(usuario)
    .innerJoin(tenant, eq(tenant.id, usuario.tenantId))
    .leftJoin(cargo, eq(cargo.id, usuario.cargoId))
    .where(and(eq(usuario.authUserId, authUserId), isNull(usuario.desativadoEm)))
    .limit(1);

  if (!row) {
    return null;
  }
  return {
    usuarioId: row.usuarioId,
    tenantId: row.tenantId,
    papel: row.papel,
    tenantNome: row.tenantNome,
    cargoNome: row.cargoNome ?? "",
    permissoes: (row.permissoes ?? []) as Permissao[],
    exige2fa: row.exige2faFlag ?? false,
  };
}
```

- [ ] **Step 2: `sessao.ts` expõe os campos novos**

Substituir `src/infra/auth/sessao.ts` por:
```typescript
import { cache } from "react";
import { exigeMfa, type Permissao } from "@/domain/auth/cargo";
import type { Papel } from "@/domain/auth/papel";
import { resolverPerfilPorAuthUserId } from "@/infra/auth/perfil-repo";
import { createSupabaseServer } from "@/infra/auth/supabase-server";
import { db } from "@/infra/db/client";

export interface SessaoUsuario {
  tenantId: string;
  usuarioId: string;
  papel: Papel;
  tenantNome: string;
  cargoNome: string;
  permissoes: Permissao[];
  exige2fa: boolean;
  /** cargo:gerir é implícito e exclusivo do Dono. */
  podeGerirCargos: boolean;
}

export const sessaoAtual = cache(async (): Promise<SessaoUsuario | null> => {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }
  const perfil = await resolverPerfilPorAuthUserId(db, user.id);
  if (!perfil) {
    return null;
  }
  return {
    tenantId: perfil.tenantId,
    usuarioId: perfil.usuarioId,
    papel: perfil.papel,
    tenantNome: perfil.tenantNome,
    cargoNome: perfil.cargoNome,
    permissoes: perfil.permissoes,
    exige2fa: exigeMfa({ chao: false, exige2fa: perfil.exige2fa, permissoes: perfil.permissoes }),
    podeGerirCargos: perfil.cargoNome === "Dono",
  };
});
```

- [ ] **Step 3: typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: verdes. Consumidores atuais que usam `sessao.papel` continuam compilando (o campo permanece).

- [ ] **Step 4: Commit**

```bash
git add src/infra/auth/perfil-repo.ts src/infra/auth/sessao.ts
git commit -m "feat(cargo): sessão carrega o cargo e suas permissões (P-1 fatia 4)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Tela `/config/cargos` (matriz de permissões + pisos ao vivo) + nav

**Files:**
- Create: `src/app/config/cargos/page.tsx`
- Create: `src/app/config/cargos/editor-cargos.tsx`
- Create: `src/app/config/cargos/actions.ts`
- Modify: `src/ui/components/app-shell.tsx` (nav)

**Interfaces:**
- Consumes: `listarCargosNoTenant`, `criarCargoNoTenant`, `editarCargoNoTenant`, `renomearCargoNoTenant`, `excluirCargoNoTenant`, `type CargoView` de `@/infra/composition/cargo`; `PERMISSOES`, `type Permissao` de `@/domain/auth/cargo`; `sessaoAtual` de `@/infra/auth/sessao`.
- Produces: rota `/config/cargos`; item de nav "Cargos".

- [ ] **Step 1: Escrever as server actions com RBAC no boundary**

`src/app/config/cargos/actions.ts` (segue o padrão de `src/app/servicos/actions.ts`, mas o gate é **exclusivo do Dono** via `sessao.podeGerirCargos` — o campo que a Task 4 já criou. `cargo:gerir` não está no catálogo atribuível de propósito):
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { type Permissao } from "@/domain/auth/cargo";
import { DadosInvalidosError } from "@/domain/shared/errors";
import { type SessaoUsuario, sessaoAtual } from "@/infra/auth/sessao";
import {
  criarCargoNoTenant,
  editarCargoNoTenant,
  excluirCargoNoTenant,
  renomearCargoNoTenant,
} from "@/infra/composition/cargo";

/** Gerir cargos é exclusivo do Dono (cargo:gerir implícito, fora do catálogo atribuível). */
async function autorizar(): Promise<{ sessao: SessaoUsuario } | { erro: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { erro: "Sua sessão expirou. Entre novamente." };
  }
  if (!sessao.podeGerirCargos) {
    return { erro: "Só o Dono gerencia cargos." };
  }
  return { sessao };
}

export interface ResultadoAcao {
  ok: boolean;
  motivo?: string;
}

export async function acaoCriarCargo(
  nome: string,
  chao: boolean,
  exige2fa: boolean,
  permissoes: string[],
): Promise<ResultadoAcao> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await criarCargoNoTenant(auth.sessao, { nome, chao, exige2fa, permissoes: permissoes as Permissao[] });
    revalidatePath("/config/cargos");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível criar o cargo." };
  }
}

export async function acaoEditarCargo(
  id: string,
  nome: string,
  chao: boolean,
  exige2fa: boolean,
  permissoes: string[],
): Promise<ResultadoAcao> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await editarCargoNoTenant(auth.sessao, id, { nome, chao, exige2fa, permissoes: permissoes as Permissao[] });
    revalidatePath("/config/cargos");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível salvar o cargo." };
  }
}

export async function acaoRenomearCargo(id: string, nome: string): Promise<ResultadoAcao> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await renomearCargoNoTenant(auth.sessao, id, nome);
    revalidatePath("/config/cargos");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível renomear." };
  }
}

export async function acaoExcluirCargo(id: string): Promise<ResultadoAcao> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await excluirCargoNoTenant(auth.sessao, id);
    revalidatePath("/config/cargos");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível excluir." };
  }
}
```

- [ ] **Step 2: Escrever a página (server component)**

`src/app/config/cargos/page.tsx`:
```typescript
import { redirect } from "next/navigation";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarCargosNoTenant } from "@/infra/composition/cargo";
import { AppShell } from "@/ui/components/app-shell";
import { EditorCargos } from "./editor-cargos";

export default async function CargosPage() {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }
  // Gerir cargos é exclusivo do Dono (cargo:gerir implícito).
  if (!sessao.podeGerirCargos) {
    redirect("/");
  }
  const cargos = await listarCargosNoTenant(sessao);
  return (
    <AppShell>
      <header className="mb-5">
        <h1 className="font-display text-3xl font-bold tracking-tight text-aco-100">Cargos</h1>
        <p className="mt-1 max-w-prose font-body text-sm text-aco-400">
          Defina as funções da sua equipe e o que cada uma vê e faz. Cargos de sistema têm permissões
          fixas — você pode renomear. Crie cargos próprios com as permissões que fizerem sentido.
        </p>
      </header>
      <EditorCargos cargos={cargos} />
    </AppShell>
  );
}
```

- [ ] **Step 3: Escrever o editor (client component) com os pisos ao vivo**

`src/app/config/cargos/editor-cargos.tsx` — matriz de checkboxes das 10 permissões, com as regras visuais:
- `chao` marcado ⇒ desabilita (cinza) as caixas `orcamento:editar`, `dinheiro:ver`, `dinheiro:ver_peca` e as remove da seleção.
- Se a seleção contém `equipe:gerir` ou `config:editar` ⇒ o toggle "Exige 2FA" fica **travado em ligado** com o rótulo "Exige 2FA (obrigatório para este conjunto)".
- Cargo `sistema` ⇒ as permissões aparecem read-only (só o nome é editável); o cargo "Dono" ganha um cadeado e nenhuma edição de permissão.

```typescript
"use client";

import { useMemo, useState, useTransition } from "react";
import { PERMISSOES, type Permissao } from "@/domain/auth/cargo";
import type { CargoView } from "@/infra/composition/cargo";
import { acaoCriarCargo, acaoEditarCargo, acaoExcluirCargo, acaoRenomearCargo } from "./actions";

const ROTULO_PERMISSAO: Record<Permissao, string> = {
  "os:abrir": "Abrir OS",
  "os:editar": "Editar OS",
  "os:avancar": "Avançar etapa (bump)",
  "triagem:override": "Mudar prioridade",
  "orcamento:editar": "Editar orçamento",
  "dinheiro:ver": "Ver valores",
  "dinheiro:ver_peca": "Ver custo de peça",
  "cadastro:editar": "Editar clientes/equipamentos",
  "equipe:gerir": "Gerir equipe",
  "config:editar": "Configurar (estações, quiosque)",
};

const PROIBIDAS_CHAO: Permissao[] = ["orcamento:editar", "dinheiro:ver", "dinheiro:ver_peca"];
const GATILHOS_2FA: Permissao[] = ["equipe:gerir", "config:editar"];

export function EditorCargos({ cargos }: { cargos: CargoView[] }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function rodar(acao: () => Promise<{ ok: boolean; motivo?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) setErro(r.motivo ?? "Não deu certo.");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <NovoCargo pendente={pendente} onCriar={(nome, chao, exige2fa, perms) => rodar(() => acaoCriarCargo(nome, chao, exige2fa, perms))} />
      <ul className="flex flex-col gap-3">
        {cargos.map((c) => (
          <LinhaCargo
            key={c.id}
            cargo={c}
            pendente={pendente}
            onRenomear={(nome) => rodar(() => acaoRenomearCargo(c.id, nome))}
            onEditar={(nome, chao, exige2fa, perms) => rodar(() => acaoEditarCargo(c.id, nome, chao, exige2fa, perms))}
            onExcluir={() => rodar(() => acaoExcluirCargo(c.id))}
          />
        ))}
      </ul>
      {erro ? <p role="alert" className="font-body text-sm text-sinal-vermelho">{erro}</p> : null}
    </div>
  );
}

/** Matriz de permissões com os pisos ao vivo. Reutilizada pelo novo cargo e pela edição. */
function MatrizPermissoes({
  chao,
  selecionadas,
  readonly,
  onToggleChao,
  onTogglePermissao,
}: {
  chao: boolean;
  selecionadas: Set<Permissao>;
  readonly: boolean;
  onToggleChao: (v: boolean) => void;
  onTogglePermissao: (p: Permissao, v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 font-body text-sm text-aco-200">
        <input type="checkbox" checked={chao} disabled={readonly} onChange={(e) => onToggleChao(e.target.checked)} />
        Cargo de chão (quiosque) — não vê valores
      </label>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {PERMISSOES.map((p) => {
          const bloqueadaPorChao = chao && PROIBIDAS_CHAO.includes(p);
          return (
            <label key={p} className={`flex items-center gap-2 font-body text-sm ${bloqueadaPorChao ? "text-aco-600" : "text-aco-200"}`}>
              <input
                type="checkbox"
                checked={selecionadas.has(p)}
                disabled={readonly || bloqueadaPorChao}
                onChange={(e) => onTogglePermissao(p, e.target.checked)}
              />
              {ROTULO_PERMISSAO[p]}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function Selo2fa({ selecionadas, exige2fa, onToggle, travado }: {
  selecionadas: Set<Permissao>;
  exige2fa: boolean;
  onToggle: (v: boolean) => void;
  travado: boolean;
}) {
  const forcado = GATILHOS_2FA.some((g) => selecionadas.has(g));
  return (
    <label className="flex items-center gap-2 font-body text-sm text-aco-200">
      <input type="checkbox" checked={forcado || exige2fa} disabled={travado || forcado} onChange={(e) => onToggle(e.target.checked)} />
      Exige 2FA{forcado ? " (obrigatório para este conjunto)" : ""}
    </label>
  );
}

function NovoCargo({ pendente, onCriar }: {
  pendente: boolean;
  onCriar: (nome: string, chao: boolean, exige2fa: boolean, perms: string[]) => void;
}) {
  const [nome, setNome] = useState("");
  const [chao, setChao] = useState(false);
  const [exige2fa, setExige2fa] = useState(false);
  const [sel, setSel] = useState<Set<Permissao>>(new Set());

  function togglePermissao(p: Permissao, v: boolean) {
    setSel((s) => {
      const n = new Set(s);
      if (v) n.add(p); else n.delete(p);
      return n;
    });
  }
  function toggleChao(v: boolean) {
    setChao(v);
    if (v) setSel((s) => {
      const n = new Set(s);
      for (const p of PROIBIDAS_CHAO) n.delete(p);
      return n;
    });
  }
  function criar() {
    if (!nome.trim()) return;
    onCriar(nome, chao, exige2fa, [...sel]);
    setNome(""); setChao(false); setExige2fa(false); setSel(new Set());
  }

  return (
    <section className="rounded-lg border border-grafite-700 bg-grafite-850 p-4">
      <h2 className="font-display text-lg text-aco-100">Novo cargo</h2>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        aria-label="Nome do cargo"
        placeholder="Ex.: Comprador"
        className="mt-3 w-full rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
      />
      <div className="mt-3">
        <MatrizPermissoes chao={chao} selecionadas={sel} readonly={false} onToggleChao={toggleChao} onTogglePermissao={togglePermissao} />
      </div>
      <div className="mt-3">
        <Selo2fa selecionadas={sel} exige2fa={exige2fa} onToggle={setExige2fa} travado={false} />
      </div>
      <button
        type="button"
        onClick={criar}
        disabled={pendente || !nome.trim()}
        className="mt-4 rounded-md bg-ambar-500 px-4 py-2 font-body text-sm font-medium text-grafite-950 hover:bg-ambar-400 disabled:opacity-50"
      >
        Criar cargo
      </button>
    </section>
  );
}

function LinhaCargo({ cargo, pendente, onRenomear, onEditar, onExcluir }: {
  cargo: CargoView;
  pendente: boolean;
  onRenomear: (nome: string) => void;
  onEditar: (nome: string, chao: boolean, exige2fa: boolean, perms: string[]) => void;
  onExcluir: () => void;
}) {
  const ehDono = cargo.nome === "Dono";
  const [nome, setNome] = useState(cargo.nome);
  const [chao, setChao] = useState(cargo.chao);
  const [exige2fa, setExige2fa] = useState(cargo.exige2fa);
  const [sel, setSel] = useState<Set<Permissao>>(() => new Set(cargo.permissoes));
  const readonlyPerms = cargo.sistema;

  const dirty = useMemo(() => nome !== cargo.nome || chao !== cargo.chao || exige2fa !== cargo.exige2fa
    || [...sel].sort().join() !== [...cargo.permissoes].sort().join(), [nome, chao, exige2fa, sel, cargo]);

  function togglePermissao(p: Permissao, v: boolean) {
    setSel((s) => { const n = new Set(s); if (v) n.add(p); else n.delete(p); return n; });
  }
  function toggleChao(v: boolean) {
    setChao(v);
    if (v) setSel((s) => { const n = new Set(s); for (const p of PROIBIDAS_CHAO) n.delete(p); return n; });
  }
  function salvar() {
    if (readonlyPerms) onRenomear(nome);
    else onEditar(nome, chao, exige2fa, [...sel]);
  }

  return (
    <li className="rounded-lg border border-grafite-700 bg-grafite-800 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {ehDono ? <span aria-hidden className="text-aco-400">🔒</span> : null}
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            aria-label={`Nome do cargo ${cargo.nome}`}
            disabled={ehDono}
            className="rounded-md border border-grafite-600 bg-grafite-900 px-2 py-1 font-body text-sm text-aco-100 disabled:opacity-60"
          />
          {cargo.sistema ? <span className="font-mono text-[11px] uppercase tracking-wide text-aco-500">sistema</span> : null}
        </div>
        {!cargo.sistema ? (
          <button type="button" onClick={onExcluir} disabled={pendente} className="font-body text-sm text-aco-400 hover:text-sinal-vermelho">
            Excluir
          </button>
        ) : null}
      </div>
      {!ehDono ? (
        <div className="mt-3 flex flex-col gap-3">
          <MatrizPermissoes chao={chao} selecionadas={sel} readonly={readonlyPerms} onToggleChao={toggleChao} onTogglePermissao={togglePermissao} />
          {!readonlyPerms ? <Selo2fa selecionadas={sel} exige2fa={exige2fa} onToggle={setExige2fa} travado={false} /> : null}
          <div>
            <button
              type="button"
              onClick={salvar}
              disabled={pendente || !dirty || !nome.trim()}
              className="rounded-md bg-ambar-500 px-3 py-1.5 font-body text-sm font-medium text-grafite-950 hover:bg-ambar-400 disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 font-body text-xs text-aco-500">O Dono tem todas as permissões e não pode ser alterado.</p>
      )}
    </li>
  );
}
```

- [ ] **Step 4: Adicionar "Cargos" à nav de config**

Em `src/ui/components/app-shell.tsx`, o array `NAV_CONFIG` (linha ~22) contém os itens de configuração, mostrados só quando `podeConfigurar` (`pode(sessao.permissoes, "config:editar")`). Adicionar "Cargos" a esse array, após "Estações":
```typescript
const NAV_CONFIG = [
  { href: "/config/equipe", rotulo: "Equipe" },
  { href: "/config/estacoes", rotulo: "Estações" },
  { href: "/config/cargos", rotulo: "Cargos" },
];
```
> Não mexer no `NAV` geral — "Cargos" é item de configuração. O gating por `podeConfigurar` já cobre a visibilidade (o Dono sempre tem `config:editar`).

- [ ] **Step 5: typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: verdes. A rota `/config/cargos` aparece no output do build.

- [ ] **Step 6: Commit**

```bash
git add src/app/config/cargos/ src/ui/components/app-shell.tsx
git commit -m "feat(cargo): tela /config/cargos com pisos ao vivo + nav (P-1 fatia 5)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Migrar Equipe + trocar consumidores de `pode(papel)` + 2FA derivado

Esta é a fatia de integração. Ordem interna: (a) trocar `rbac.ts` para operar sobre permissões; (b) trocar todos os consumidores; (c) migrar Equipe; (d) 2FA no login/equipe. (A sessão já foi enriquecida na Task 4.)

**Files:**
- Modify: `src/domain/auth/rbac.ts`
- Modify (consumidores): `src/ui/components/app-shell.tsx`, `src/app/page.tsx`, `src/app/relatorio/page.tsx`, `src/app/os/[id]/page.tsx`, `src/app/os/actions.ts`, `src/app/servicos/page.tsx`, `src/app/servicos/actions.ts`, `src/app/config/estacoes/page.tsx`, `src/app/config/estacoes/actions.ts`, `src/app/config/demonstracao/actions.ts`, `src/app/config/equipe/page.tsx`, `src/app/config/equipe/actions.ts`, `src/app/config/cargos/{page,actions}.ts`
- Modify (Equipe): `src/application/equipe.ts`, `src/app/config/equipe/painel-equipe.tsx`, `src/app/config/equipe/page.tsx`
- Modify (2FA): `src/infra/auth/supabase-middleware.ts`, `src/application/login.ts`

**Interfaces:**
- Consumes: `pode`, `exigeMfa`, `type Permissao` de `@/domain/auth/cargo`; `listarCargosNoTenant`, `contarDonosNoTenant` de `@/infra/composition/cargo`.
- Produces: `SessaoUsuario` ganha `permissoes: Permissao[]`, `exige2fa: boolean`, `podeGerirCargos: boolean`, `cargoNome: string`.

- [ ] **Step 1: `rbac.ts` — `pode`/`assertPode` sobre permissões (reexport do domínio de cargo)**

O `rbac.ts` antigo opera sobre `Papel`. Substituí-lo por reexports do domínio de cargo, mantendo `assertPode` sobre permissões. Como o mapeamento `usuario:gerenciar` → `equipe:gerir` muda a chave, trocar os consumidores é o passo seguinte. Novo `src/domain/auth/rbac.ts`:
```typescript
import { AutorizacaoNegadaError } from "@/domain/shared/errors";
import { type Permissao, pode } from "./cargo";

/**
 * RBAC (P-1): agora opera sobre o CONJUNTO DE PERMISSÕES do cargo, não sobre o papel fixo.
 * `pode` vem do domínio de cargo. `assertPode` é o enforcement do servidor.
 */
export { pode } from "./cargo";
export type { Permissao } from "./cargo";

export function assertPode(permissoes: readonly string[], acao: Permissao): void {
  if (!pode(permissoes, acao)) {
    throw new AutorizacaoNegadaError("cargo", acao);
  }
}
```
> Verificar a assinatura de `AutorizacaoNegadaError` em `src/domain/shared/errors.ts`; se ela exige `(papel, acao)` com tipos específicos, ajustar a chamada (pode passar a string do cargo). O antigo `ACOES` de `rbac.ts` deixa de existir — quem importava `ACOES`/`Acao` passa a importar `PERMISSOES`/`Permissao` do domínio de cargo (só `servicos/actions.ts` usava `type Acao`; ver Step 5).

- [ ] **Step 2: Trocar os consumidores de leitura (`pode(sessao.papel, X)` → `pode(sessao.permissoes, X)`)**

Em cada arquivo abaixo, trocar `pode(sessao.papel, "…")` por `pode(sessao.permissoes, "…")` e ajustar o import para `@/domain/auth/cargo` (ou o reexport de `rbac`). Mapeamento de chaves que mudaram:
- `usuario:gerenciar` → `equipe:gerir` (em `src/app/relatorio/page.tsx` e `src/app/config/equipe/page.tsx`).

Arquivos e trocas:
- `src/ui/components/app-shell.tsx:57` — `pode(sessao.permissoes, "config:editar")`.
- `src/app/page.tsx:22` — `pode(sessao.permissoes, "config:editar")`.
- `src/app/relatorio/page.tsx:31` — `!pode(sessao.permissoes, "config:editar") && !pode(sessao.permissoes, "equipe:gerir")`.
- `src/app/os/[id]/page.tsx:69-70` — `pode(sessao.permissoes, "orcamento:editar")` e `pode(sessao.permissoes, "os:editar")`.
- `src/app/servicos/page.tsx:20` — `pode(sessao.permissoes, "orcamento:editar")`.
- `src/app/config/estacoes/page.tsx:21` — `pode(sessao.permissoes, "config:editar")`.
- `src/app/config/equipe/page.tsx:20` — `pode(sessao.permissoes, "equipe:gerir")`.

- [ ] **Step 3: Trocar os consumidores de action (o `autorizar(acao)` recebe `sessao.permissoes`)**

Nas actions que têm um helper `autorizar(acao)` que faz `if (!pode(sessao.papel, acao))`, trocar para `sessao.permissoes` e tipar `acao: Permissao`. Arquivos:
- `src/app/servicos/actions.ts:22` (e o import `type Acao` → `type Permissao` de `@/domain/auth/cargo`).
- `src/app/os/actions.ts:50`.
- `src/app/config/estacoes/actions.ts:25`.
- `src/app/config/demonstracao/actions.ts:17`.
- `src/app/config/equipe/actions.ts:23`.
Para cada um: `if (!pode(sessao.permissoes, acao))`.

- [ ] **Step 4: Equipe passa a atribuir CARGO (não papel)**

`src/application/equipe.ts`:
- `MembroView` ganha `cargoId: string | null` e `cargoNome: string`. A query junta `cargo`.
- `ConvidarMembroInput` troca `papel: Papel` por `cargoId: string`. O `requires_mfa` do convite passa a vir do cargo: buscar o cargo (permissoes + exige2fa) e usar `exigeMfa` do domínio de cargo. `usuario.papel` continua sendo gravado (legado) — derive um papel default do cargo (ex.: se cargoNome ∈ {Dono,Gestor,Recepção,Produção} usa o papel equivalente; senão `producao` como piso seguro) OU mantenha um `papel` fixo `producao` para cargos novos. **Decisão do plano:** gravar `papel` derivado do nome do cargo-semente quando bater, senão `producao` (o `papel` é legado e não manda mais no RBAC).
- `mudarPapel` vira `mudarCargo(database, sessao, membroId, cargoId)`: valida que não é o próprio usuário; e o **Piso 1 (último Dono)** — se o alvo é o único Dono ativo e o novo cargo não é Dono, lança `DadosInvalidosError("A oficina precisa de ao menos um Dono.")`. Usa `contarUsuariosComCargoDono`.

Escrever os testes correspondentes em `src/application/__tests__/equipe.test.ts` (se existir) ou criar casos no de cargo: "não rebaixa o último Dono", "convite com cargoId liga o usuário ao cargo".

- [ ] **Step 5: `painel-equipe.tsx` — seletor de cargo**

Trocar o `ROTULO_PAPEL`/`AJUDA_PAPEL` fixos por uma lista de cargos vinda por prop (a `page.tsx` passa `cargos: {id, nome}[]` de `listarCargosNoTenant`). O `<select>` de papel vira `<select>` de cargo (value = cargoId). O convite e o `mudarCargo` passam `cargoId`. A `page.tsx` (`src/app/config/equipe/page.tsx`) busca os cargos e passa para o `PainelEquipe`.

- [ ] **Step 6: 2FA — middleware e login usam o cargo**

- `src/application/login.ts:77` — `mfaRequerido: exigeMfa(perfilComoCargo) && !signIn.aal2`. Como `login.ts` usa `perfil.papel` hoje, e o perfil agora traz `permissoes`+`exige2fa`, trocar para `exigeMfa({ chao: false, exige2fa: perfil.exige2fa, permissoes: perfil.permissoes })` (import de `@/domain/auth/cargo`). Remover o import de `exigeMfa` de `@/domain/auth/papel`.
- `src/infra/auth/supabase-middleware.ts` — hoje lê `user.app_metadata?.requires_mfa`. Isso **continua funcionando** (o convite grava `requires_mfa` derivado do cargo). Não é preciso mudar o middleware nesta leva — ele lê o JWT, que já reflete o cargo via convite. Deixar como está; anotar no relatório que o `requires_mfa` do JWT é populado no convite (Step 7) e no onboarding.

- [ ] **Step 7: Regressão — rodar TODA a suíte**

Run: `pnpm test`
Expected: verde. Em especial os testes que antes usavam `pode("producao", …)` — o `rbac.test.ts` antigo referencia `Papel`; **atualizá-lo** para o novo `pode(permissoes, acao)` (ex.: `pode(["os:avancar"], "os:avancar")`), e o `papel.test.ts` de `exigeMfa(papel)` já é coberto pelo novo `cargo.test.ts` — se o `papel.test.ts` quebrar por causa da assinatura antiga, mantê-lo testando só o drift `PAPEIS × papel_usuario.enumValues` (que continua válido) e remover as asserções de `exigeMfa(papel)` (a função saiu de `papel.ts`; se preferir manter `exigeMfa(papel)` como shim legado, não — YAGNI, remover as asserções).

- [ ] **Step 8: typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: verdes. Nenhum import órfão de `ACOES`/`Acao`/`exigeMfa` de `papel`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(cargo): Equipe atribui cargo + RBAC sobre permissões + 2FA derivado (P-1 fatia 6)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Pipeline + deploy (CI verde → migration cloud → railway up → smoke)

**Files:** nenhum código novo; conduz o merge e o deploy. (Executada pelo controlador, não por subagente.)

- [ ] **Step 1: Rodar o pipeline local completo**

Run: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`
Expected: tudo verde. (Se o Docker de teste estiver fora, confiar no CI para os testes de DB.)

- [ ] **Step 2: Merge da branch no main + push**

```bash
git checkout main
git merge --no-ff feat/cargos-configuraveis -m "feat(cargo): cargos configuráveis por tenant (P-1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 3: Aguardar o CI ficar verde**

Run: `gh run watch $(gh run list --branch main --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`
Expected: exit 0 — build/lint/typecheck/testes (incl. isolamento de cargo) + checagem de migrations.

- [ ] **Step 4: Aplicar as migrations no cloud**

Run: `railway run --service igni-app pnpm db:migrate`
Expected: aplica as migrations novas (schema cargo, RLS, seed) sem erro; "migrations applied successfully". Os NOTICE de idempotência do drizzle são normais.

- [ ] **Step 5: Verificar cargo + RLS + seed no cloud**

Escrever um script temporário na raiz do projeto (`verify-cargo.mjs`, removido depois) que, via `postgres` + `DATABASE_URL` do Railway, confere: (a) tabela `cargo` existe com as 8 colunas; (b) `relrowsecurity=true`, `force=false`; (c) policy `cargo_tenant_isolation`; (d) grants de `app_user`; (e) que cada tenant tem 7 cargos e que **nenhum usuário ativo ficou com `cargo_id` nulo** (`SELECT count(*) FROM usuario WHERE cargo_id IS NULL AND desativado_em IS NULL` = 0). Rodar com `railway run --service igni-app node verify-cargo.mjs`. Remover o script após verificar. (Padrão idêntico ao usado no deploy do P-2.)

- [ ] **Step 6: Deploy**

Run: `railway up --service igni-app --ci`
Expected: "Deploy complete".

- [ ] **Step 7: Smoke test (curl, sem Playwright)**

```bash
BASE="https://igni-app-production.up.railway.app"
curl -s -o /dev/null -w "login %{http_code}\n" "$BASE/login"          # espera 200
curl -s -o /dev/null -w "cargos %{http_code} -> %{redirect_url}\n" "$BASE/config/cargos"  # espera 307 -> /login
```
Expected: `/login` 200; `/config/cargos` 307 → /login (rota nova + guard ativos).

- [ ] **Step 8: Atualizar docs + apagar branch + memória**

- `docs/00_status.md`: registrar P-1 no ar.
- `docs/15_backlog_produto.md`: marcar P-1 como ✅ NO AR; atualizar a ordem sugerida (próximo: P-3 controle remoto de TV; P-4 financeiro).
- `git branch -d feat/cargos-configuraveis`.
- Memória: criar `cargos-configuraveis-p1.md` (o modelo de cargo, os 4 pisos, `cargo:gerir` só do Dono, enum papel = legado tolerado) + ponteiro no `MEMORY.md`.

---

## Self-review (feito pelo autor do plano)

**Ordem das 7 tasks:** 1 schema+seed → 2 domínio → 3 aplicação+composição → **4 enriquecer a sessão** → 5 tela `/config/cargos` → 6 integração (Equipe + consumidores + 2FA) → 7 deploy. A Task 4 (sessão) vem antes da tela e dos consumidores de propósito: cria `sessao.permissoes`/`podeGerirCargos` ADICIONANDO campos (nada quebra, `papel` coexiste), então a tela (Task 5) e os consumidores (Task 6) já leem o campo real — sem proxy, sem TODO.

**1. Cobertura do spec:**
- Tabela `cargo` + RLS + `usuario.cargo_id` → Task 1. ✓
- Seed por tenant + liga usuários → Task 1 (Step 6). ✓
- Catálogo de permissões + `validarCargo` (4 pisos) + `exigeMfa(cargo)` + `pode` → Task 2. ✓
- `cargo:gerir` fora do catálogo, exclusivo do Dono → Task 2 (validarCargo rejeita) + Task 4 (`podeGerirCargos`) + Task 5 (gate da tela). ✓
- CRUD + último Dono → Task 3 (CRUD + `contarUsuariosComCargoDono`) + Task 6 (Step 4, `mudarCargo` barra o último Dono). ✓
- Tela `/config/cargos` com pisos ao vivo → Task 5. ✓
- Migrar Equipe + trocar consumidores + 2FA derivado → Task 6. ✓
- Enum `papel` permanece → não há task de remoção; `perfil-repo` (Task 4) mantém `papel`. ✓
- Pipeline + deploy + isolamento A↔B → Task 7 + testes de isolamento nas Tasks 1 e 3. ✓

**2. Placeholders:** sem TBD/TODO de implementação (a reordenação eliminou o proxy de gate — a Task 5 já usa `podeGerirCargos`). Os números de migration (`00XX/00YY/00ZZ`) são o índice real que `drizzle-kit generate` cria no Step 4 da Task 1 — o executor anota o número gerado e usa nos Steps 5-6; não são placeholders de código.

**3. Consistência de tipos:** `pode(permissoes, acao)` uniforme da Task 2 em diante; `CargoView`/`CargoInput` idênticos entre aplicação (Task 3), composição e UI (Tasks 3, 5); `SessaoUsuario` com `permissoes/exige2fa/podeGerirCargos/cargoNome` definido na Task 4 e consumido pelas Tasks 5-6; `CARGOS_SEMENTE` (domínio, Task 2) espelha o seed SQL (Task 1) — o teste de drift (Task 2, Step 1) cobre a divergência de nomes/permissões.

**4. Risco residual conhecido (para o revisor final):** a Task 6 é grande (toca ~15 arquivos) — é a fatia de integração inerente a trocar a fonte de verdade do RBAC. Mitigação: as Tasks 1-5 já deixam o novo modelo pronto e testado; a Task 6 é majoritariamente mecânica (trocar `sessao.papel`→`sessao.permissoes`) + a lógica real do "último Dono" (com teste). O `requires_mfa` do JWT continua sendo populado no convite/onboarding, então o middleware não muda nesta leva.
