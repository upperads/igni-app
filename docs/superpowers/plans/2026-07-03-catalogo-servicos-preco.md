# Catálogo de Serviços com Preço (P-2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A recepção seleciona serviços pré-cadastrados com preço no orçamento (em vez de digitar cada item à mão), com um catálogo por tenant e reajuste de preços em massa.

**Architecture:** Tabela `servico` por tenant (RLS), espelhando o padrão da `estacao`. O preço é **sugestão**: escolher um serviço COPIA seus dados para uma linha editável do orçamento — sem FK entre `orcamento_item` e `servico`, e `montarOrcamento` não muda. Camadas: domínio puro (validação + conta do reajuste) → aplicação (`withTenant`) → composição → web (`/servicos` + botão "Do catálogo" no builder).

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), TypeScript strict, Drizzle + Postgres (Supabase), RLS via `withTenant` (`SET LOCAL app.current_tenant` + `role app_user`), Vitest.

## Global Constraints

- **Schema/migration primeiro**, uma fatia por vez; **migrations só via Drizzle** (`pnpm db:generate` → editar SQL de RLS à mão → `pnpm db:migrate`). Nunca SQL manual em prod.
- **Toda tabela nova com dado de tenant nasce com `tenant_id` + política RLS na MESMA migration** (regra de ouro #7). RLS de tabela nova = `GRANT SELECT,INSERT,UPDATE,DELETE ... TO app_user` + `ENABLE ROW LEVEL SECURITY` (SEM `FORCE`, como 0011/0019) + policy `USING/WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)`.
- **Teste de isolamento multi-tenant obrigatório** em cada fatia que toca dados: catálogo/reajuste de A nunca vê/afeta B.
- **Verificação a cada fatia:** `pnpm typecheck` && `pnpm lint` && `pnpm build` && `pnpm test`. **CI verde antes do deploy.** Deploy `railway up --service igni-app --ci`. **SEM Playwright.**
- **Dinheiro em CENTAVOS inteiros** em todo lugar (nunca float). O enum `tipo_item_orcamento` (`peca`/`mao_de_obra`/`terceiro`) já existe — **reusar**, não recriar.
- **Boundary guard (ESLint):** `src/app/**` NUNCA importa `db`/`database` de `@/infra/db/client`; sempre via `@/infra/composition/*`.
- **RBAC:** `orcamento:editar` (dono/gestor/recepção) gerencia o catálogo. A regra de ouro: **produção não edita orçamento** (nem o catálogo).
- **Preço = sugestão:** escolher do catálogo copia; `montarOrcamento` NÃO muda; `orcamento_item` NÃO ganha FK. Mudar/apagar serviço nunca afeta orçamento já feito.
- **DB de teste:** Docker `igni-db` na porta 5433 (`TEST_DATABASE_URL`). `docker start igni-db` antes de `pnpm test`. Se o Docker estiver fora, confiar no CI.

---

## File Structure

**Schema (Drizzle):**
- Create `src/infra/db/schema/servico.ts` — tabela `servico`.
- Modify `src/infra/db/schema/index.ts` — reexport.
- Create migration `NNNN_*.sql` (gerada) + migration RLS custom `NNNN+1_rls_servico.sql`.

**Domínio (puro):**
- Create `src/domain/orcamento/servico.ts` — `validarServico`, `aplicarReajuste`, `PCT_REAJUSTE_MIN/MAX`.

**Aplicação:**
- Create `src/application/servico.ts` — `listarServicos`, `criarServico`, `editarServico`, `desativarServico`, `reativarServico`, `reajustarPrecos`.

**Composição:**
- Create `src/infra/composition/servico.ts` — wrappers `*NoTenant`.

**Web:**
- Create `src/app/servicos/page.tsx`, `editor-servicos.tsx`, `actions.ts`, `reajuste-modal.tsx`.
- Modify `src/ui/components/app-shell.tsx` — item "Serviços" na nav.
- Modify `src/app/os/[id]/orcamento.tsx` — botão "Do catálogo".
- Create `src/app/os/[id]/seletor-catalogo.tsx` — o seletor client.
- Modify `src/app/os/[id]/page.tsx` — carregar o catálogo e passar ao builder.

**Testes:**
- Create `src/infra/db/__tests__/servico-isolation.test.ts`.
- Create `src/domain/orcamento/__tests__/servico.test.ts`.
- Create `src/application/__tests__/servico.test.ts`.

---

## Task 1: Schema + migration (servico + RLS)

**Files:**
- Create: `src/infra/db/schema/servico.ts`
- Modify: `src/infra/db/schema/index.ts`
- Create: migração gerada + `NNNN_rls_servico.sql`
- Test: `src/infra/db/__tests__/servico-isolation.test.ts`

**Interfaces:**
- Produces: tabela Drizzle `servico` com colunas `id, tenantId, nome, tipo, valorCentavos, markupPct, ativo, createdAt`.

- [ ] **Step 1: Criar o schema da tabela**

Create `src/infra/db/schema/servico.ts`:

```typescript
import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tipoItemOrcamento } from "./enums";
import { tenant } from "./tenant";

/**
 * Catálogo de serviços por tenant (P-2). Fonte de SUGESTÃO de preço: o orçamento COPIA o serviço para
 * uma linha editável (sem FK), então mudar/desativar um serviço nunca altera orçamentos já feitos.
 * `tipo` reusa o enum do item de orçamento (fala a mesma língua da linha). Dinheiro em centavos inteiros.
 * `ativo` desativa sem apagar (preserva histórico). Config por tenant com RLS (padrão da `estacao`).
 */
export const servico = pgTable("servico", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  tipo: tipoItemOrcamento("tipo").notNull(),
  valorCentavos: integer("valor_centavos").notNull(),
  markupPct: integer("markup_pct").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Reexportar no barrel**

Modify `src/infra/db/schema/index.ts` — adicionar ao fim:

```typescript
export * from "./servico";
```

- [ ] **Step 3: Gerar a migration**

Run: `pnpm db:generate`
Expected: cria `src/infra/db/migrations/NNNN_<slug>.sql` com `CREATE TABLE "servico" (...)` + a FK para tenant. Sem migration = FALHA; confira o arquivo. Anote o número `NNNN`.

- [ ] **Step 4: Criar a migration RLS custom**

Descubra o próximo número (`NNNN+1`). Create `src/infra/db/migrations/<NNNN+1>_rls_servico.sql`:

```sql
-- RLS multi-tenant do catálogo de serviços (P-2). Mesmo padrão do 0011/0019:
-- GRANT ao app_user + ENABLE (SEM FORCE) + política de isolamento por tenant.
-- `app_user` já existe (migration 0001).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "servico" TO app_user;--> statement-breakpoint

ALTER TABLE "servico" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY servico_tenant_isolation ON "servico"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
```

Verifique que a entrada da migration RLS aparece em `src/infra/db/migrations/meta/_journal.json` na sequência (idx/tag/when/breakpoints) — replique o formato das entradas RLS anteriores (0011, 0019). Se o drizzle-kit não registrou automaticamente, adicione a entrada à mão como nas migrations `*_rls_*` existentes.

- [ ] **Step 5: Escrever o teste de isolamento (RED)**

Create `src/infra/db/__tests__/servico-isolation.test.ts`:

```typescript
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/infra/db/connection";
import { servico, tenant } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

/** Isolamento RLS da tabela servico (regra de ouro #7): A nunca vê/toca o catálogo de B. */
describe("isolamento multi-tenant — servico (RLS)", () => {
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
    await database.db.delete(servico);
    await database.db.delete(tenant);
    const [a] = await database.db
      .insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db
      .insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    tenantA = a!.id;
    tenantB = b!.id;
  });

  it("A enxerga apenas os próprios serviços", async () => {
    await database.db.insert(servico).values({
      tenantId: tenantA, nome: "Plaina", tipo: "mao_de_obra", valorCentavos: 8000,
    });
    await database.db.insert(servico).values({
      tenantId: tenantB, nome: "Solda", tipo: "terceiro", valorCentavos: 20000,
    });

    const vistos = await database.withTenant(tenantA, (tx) => tx.select().from(servico));
    expect(vistos).toHaveLength(1);
    expect(vistos[0]!.nome).toBe("Plaina");

    const deB = await database.withTenant(tenantA, (tx) =>
      tx.select().from(servico).where(eq(servico.nome, "Solda")),
    );
    expect(deB).toHaveLength(0);
  });

  it("a RLS barra ESCREVER um serviço marcado como de outro tenant (WITH CHECK)", async () => {
    await expect(
      database.withTenant(tenantA, (tx) =>
        tx.insert(servico).values({
          tenantId: tenantB, nome: "Intruso", tipo: "peca", valorCentavos: 100,
        }),
      ),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 6: Aplicar migration no DB de teste e rodar**

Run: `docker start igni-db` (se preciso) e `pnpm test src/infra/db/__tests__/servico-isolation.test.ts`
Expected: PASS (o `resetAndMigrate` aplica todas as migrations, incluindo a RLS nova). Se falhar por "relation servico does not exist", a migration RLS não entrou no journal — reveja o Step 4.

- [ ] **Step 7: typecheck + commit**

Run: `pnpm typecheck`
Expected: sem erros.

```bash
git add src/infra/db/schema/ src/infra/db/migrations/ src/infra/db/__tests__/servico-isolation.test.ts
git commit -m "feat(servico): schema do catálogo + RLS por tenant (P-2 fatia 1)"
```

---

## Task 2: Domínio puro (validação + reajuste)

**Files:**
- Create: `src/domain/orcamento/servico.ts`
- Test: `src/domain/orcamento/__tests__/servico.test.ts`

**Interfaces:**
- Produces: `validarServico({nome, valorCentavos, markupPct}): void` (lança `DadosInvalidosError`); `aplicarReajuste(centavos: number, pct: number): number`; `PCT_REAJUSTE_MIN = -90`; `PCT_REAJUSTE_MAX = 200`; `pctReajusteValido(pct: number): boolean`.

- [ ] **Step 1: Teste (RED)**

Create `src/domain/orcamento/__tests__/servico.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { DadosInvalidosError } from "@/domain/shared/errors";
import {
  aplicarReajuste,
  pctReajusteValido,
  validarServico,
} from "@/domain/orcamento/servico";

describe("servico — validação", () => {
  it("aceita um serviço válido", () => {
    expect(() => validarServico({ nome: "Plaina", valorCentavos: 8000, markupPct: 0 })).not.toThrow();
  });
  it("rejeita nome vazio, valor negativo, markup negativo, não-inteiros", () => {
    expect(() => validarServico({ nome: "  ", valorCentavos: 8000, markupPct: 0 })).toThrow(DadosInvalidosError);
    expect(() => validarServico({ nome: "X", valorCentavos: -1, markupPct: 0 })).toThrow(DadosInvalidosError);
    expect(() => validarServico({ nome: "X", valorCentavos: 100, markupPct: -5 })).toThrow(DadosInvalidosError);
    expect(() => validarServico({ nome: "X", valorCentavos: 10.5, markupPct: 0 })).toThrow(DadosInvalidosError);
  });
});

describe("servico — reajuste em massa", () => {
  it("aplica +10% arredondando ao centavo", () => {
    expect(aplicarReajuste(10000, 10)).toBe(11000);
    expect(aplicarReajuste(999, 10)).toBe(1099); // 1098.9 → 1099
  });
  it("aceita desconto (pct negativo)", () => {
    expect(aplicarReajuste(10000, -20)).toBe(8000);
  });
  it("valida o intervalo do pct (-90 a +200)", () => {
    expect(pctReajusteValido(10)).toBe(true);
    expect(pctReajusteValido(-90)).toBe(true);
    expect(pctReajusteValido(200)).toBe(true);
    expect(pctReajusteValido(-91)).toBe(false);
    expect(pctReajusteValido(201)).toBe(false);
    expect(pctReajusteValido(1.5)).toBe(false); // só inteiro
  });
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pnpm test src/domain/orcamento/__tests__/servico.test.ts`
Expected: FAIL ("Cannot find module '@/domain/orcamento/servico'").

- [ ] **Step 3: Implementar**

Create `src/domain/orcamento/servico.ts`:

```typescript
import { DadosInvalidosError } from "@/domain/shared/errors";

/** Intervalo sensato do reajuste em massa — evita erro grosseiro (ex.: apagar preço com -100%). */
export const PCT_REAJUSTE_MIN = -90;
export const PCT_REAJUSTE_MAX = 200;

/** Valida os campos monetários/nome de um serviço do catálogo. Lança DadosInvalidosError. */
export function validarServico(input: { nome: string; valorCentavos: number; markupPct: number }): void {
  if (!input.nome.trim()) {
    throw new DadosInvalidosError("Dê um nome ao serviço.");
  }
  if (!Number.isInteger(input.valorCentavos) || input.valorCentavos < 0) {
    throw new DadosInvalidosError("Valor do serviço inválido.");
  }
  if (!Number.isInteger(input.markupPct) || input.markupPct < 0) {
    throw new DadosInvalidosError("Markup do serviço inválido.");
  }
}

/** Reajuste de um preço (centavos) em `pct` por cento, arredondado ao centavo. Aceita pct negativo. */
export function aplicarReajuste(centavos: number, pct: number): number {
  return Math.round((centavos * (100 + pct)) / 100);
}

/** Percentual de reajuste em massa aceito: inteiro dentro do intervalo. */
export function pctReajusteValido(pct: number): boolean {
  return Number.isInteger(pct) && pct >= PCT_REAJUSTE_MIN && pct <= PCT_REAJUSTE_MAX;
}
```

- [ ] **Step 4: Rodar (deve passar) + typecheck + commit**

Run: `pnpm test src/domain/orcamento/__tests__/servico.test.ts && pnpm typecheck`
Expected: PASS, sem erros.

```bash
git add src/domain/orcamento/servico.ts src/domain/orcamento/__tests__/servico.test.ts
git commit -m "feat(servico): domínio puro — validação + reajuste em massa (P-2 fatia 2)"
```

---

## Task 3: Aplicação (CRUD + reajuste, escopado ao tenant)

**Files:**
- Create: `src/application/servico.ts`
- Test: `src/application/__tests__/servico.test.ts`

**Interfaces:**
- Consumes: `Database` (`@/infra/db/connection`), `SessaoTenant` (`@/application/abrir-os`), `validarServico`/`aplicarReajuste`/`pctReajusteValido` (`@/domain/orcamento/servico`), `TipoItem` (`@/domain/orcamento/orcamento`), schema (`servico`).
- Produces:
  - `ServicoView = { id: string; nome: string; tipo: TipoItem; valorCentavos: number; markupPct: number; ativo: boolean }`
  - `listarServicos(db, sessao, opts?: { incluirInativos?: boolean }): Promise<ServicoView[]>`
  - `criarServico(db, sessao, { nome, tipo, valorCentavos, markupPct }): Promise<{ id: string }>`
  - `editarServico(db, sessao, id, { nome, tipo, valorCentavos, markupPct }): Promise<void>`
  - `desativarServico(db, sessao, id): Promise<void>` / `reativarServico(db, sessao, id): Promise<void>`
  - `reajustarPrecos(db, sessao, pct): Promise<{ afetados: number }>` (lança `DadosInvalidosError` se pct fora do intervalo)

- [ ] **Step 1: Teste (RED)**

Create `src/application/__tests__/servico.test.ts`:

```typescript
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SessaoTenant } from "@/application/abrir-os";
import {
  criarServico,
  desativarServico,
  editarServico,
  listarServicos,
  reajustarPrecos,
  reativarServico,
} from "@/application/servico";
import type { Database } from "@/infra/db/connection";
import { servico, tenant, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

describe("servico — aplicação (CRUD + reajuste)", () => {
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
    await database.db.delete(servico);
    await database.db.delete(usuario);
    await database.db.delete(tenant);
    const [a] = await database.db.insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db.insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    const [ua] = await database.db.insert(usuario).values({ tenantId: a!.id, nome: "Recep A", email: "a@a.com", papel: "recepcao" }).returning();
    const [ub] = await database.db.insert(usuario).values({ tenantId: b!.id, nome: "Recep B", email: "b@b.com", papel: "recepcao" }).returning();
    sessaoA = { tenantId: a!.id, usuarioId: ua!.id };
    sessaoB = { tenantId: b!.id, usuarioId: ub!.id };
  });

  it("cria, lista e edita um serviço no tenant", async () => {
    const { id } = await criarServico(database, sessaoA, { nome: "Plaina", tipo: "mao_de_obra", valorCentavos: 8000, markupPct: 0 });
    let lista = await listarServicos(database, sessaoA);
    expect(lista).toHaveLength(1);
    expect(lista[0]!.nome).toBe("Plaina");
    await editarServico(database, sessaoA, id, { nome: "Plaina de cabeçote", tipo: "mao_de_obra", valorCentavos: 9000, markupPct: 0 });
    lista = await listarServicos(database, sessaoA);
    expect(lista[0]!.nome).toBe("Plaina de cabeçote");
    expect(lista[0]!.valorCentavos).toBe(9000);
  });

  it("desativar tira da lista padrão; incluirInativos mostra; reativar volta", async () => {
    const { id } = await criarServico(database, sessaoA, { nome: "X", tipo: "peca", valorCentavos: 100, markupPct: 0 });
    await desativarServico(database, sessaoA, id);
    expect(await listarServicos(database, sessaoA)).toHaveLength(0);
    expect(await listarServicos(database, sessaoA, { incluirInativos: true })).toHaveLength(1);
    await reativarServico(database, sessaoA, id);
    expect(await listarServicos(database, sessaoA)).toHaveLength(1);
  });

  it("reajuste em massa aplica +10% só nos ATIVOS do tenant", async () => {
    await criarServico(database, sessaoA, { nome: "A1", tipo: "peca", valorCentavos: 10000, markupPct: 0 });
    const inativo = await criarServico(database, sessaoA, { nome: "A2", tipo: "peca", valorCentavos: 5000, markupPct: 0 });
    await desativarServico(database, sessaoA, inativo.id);

    const r = await reajustarPrecos(database, sessaoA, 10);
    expect(r.afetados).toBe(1);
    const todos = await listarServicos(database, sessaoA, { incluirInativos: true });
    const a1 = todos.find((s) => s.nome === "A1")!;
    const a2 = todos.find((s) => s.nome === "A2")!;
    expect(a1.valorCentavos).toBe(11000); // ativo reajustado
    expect(a2.valorCentavos).toBe(5000); // inativo intacto
  });

  it("reajuste rejeita pct fora do intervalo", async () => {
    await expect(reajustarPrecos(database, sessaoA, 999)).rejects.toThrow();
  });

  it("isolamento: reajuste de A não toca serviços de B; A não edita serviço de B", async () => {
    await criarServico(database, sessaoA, { nome: "A1", tipo: "peca", valorCentavos: 10000, markupPct: 0 });
    const b = await criarServico(database, sessaoB, { nome: "B1", tipo: "peca", valorCentavos: 10000, markupPct: 0 });

    await reajustarPrecos(database, sessaoA, 50);
    const [bServ] = await database.db.select().from(servico).where(eq(servico.id, b.id));
    expect(bServ!.valorCentavos).toBe(10000); // B intacto

    // A tenta editar o serviço de B: RLS não acha a linha → no-op
    await editarServico(database, sessaoA, b.id, { nome: "Invadido", tipo: "peca", valorCentavos: 1, markupPct: 0 });
    const [bDepois] = await database.db.select().from(servico).where(eq(servico.id, b.id));
    expect(bDepois!.nome).toBe("B1");
  });
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pnpm test src/application/__tests__/servico.test.ts`
Expected: FAIL ("Cannot find module '@/application/servico'").

- [ ] **Step 3: Implementar**

Create `src/application/servico.ts`:

```typescript
import { and, asc, eq, sql } from "drizzle-orm";
import { type TipoItem } from "@/domain/orcamento/orcamento";
import { aplicarReajuste, pctReajusteValido, validarServico } from "@/domain/orcamento/servico";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { servico } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/**
 * Catálogo de serviços (P-2): a oficina mantém sua tabela de preços. Fonte de SUGESTÃO — o orçamento
 * copia o serviço para uma linha editável (sem FK). Tudo escopado ao tenant (`withTenant` → RLS).
 * Gerido por quem edita orçamento (RBAC no boundary da action).
 */

export interface ServicoView {
  id: string;
  nome: string;
  tipo: TipoItem;
  valorCentavos: number;
  markupPct: number;
  ativo: boolean;
}

export interface ServicoInput {
  nome: string;
  tipo: TipoItem;
  valorCentavos: number;
  markupPct: number;
}

/** Lista os serviços do tenant (ativos por padrão; `incluirInativos` traz todos). Ordenado por nome. */
export function listarServicos(
  database: Database,
  sessao: SessaoTenant,
  opts?: { incluirInativos?: boolean },
): Promise<ServicoView[]> {
  return database.withTenant(sessao.tenantId, (tx) => {
    const base = tx
      .select({
        id: servico.id,
        nome: servico.nome,
        tipo: servico.tipo,
        valorCentavos: servico.valorCentavos,
        markupPct: servico.markupPct,
        ativo: servico.ativo,
      })
      .from(servico)
      .orderBy(asc(servico.nome));
    return opts?.incluirInativos ? base : base.where(eq(servico.ativo, true));
  });
}

/** Cria um serviço no catálogo do tenant. Valida nome/valor/markup. */
export function criarServico(
  database: Database,
  sessao: SessaoTenant,
  input: ServicoInput,
): Promise<{ id: string }> {
  validarServico(input);
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [novo] = await tx
      .insert(servico)
      .values({
        tenantId: sessao.tenantId,
        nome: input.nome.trim(),
        tipo: input.tipo,
        valorCentavos: input.valorCentavos,
        markupPct: input.markupPct,
      })
      .returning({ id: servico.id });
    return { id: novo!.id };
  });
}

/** Edita um serviço do tenant. Valida os campos. RLS garante que só o próprio tenant altera. */
export function editarServico(
  database: Database,
  sessao: SessaoTenant,
  id: string,
  input: ServicoInput,
): Promise<void> {
  validarServico(input);
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx
      .update(servico)
      .set({
        nome: input.nome.trim(),
        tipo: input.tipo,
        valorCentavos: input.valorCentavos,
        markupPct: input.markupPct,
      })
      .where(eq(servico.id, id));
  });
}

/** Desativa um serviço (some da escolha, preserva o histórico). */
export function desativarServico(database: Database, sessao: SessaoTenant, id: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx.update(servico).set({ ativo: false }).where(eq(servico.id, id));
  });
}

/** Reativa um serviço desativado. */
export function reativarServico(database: Database, sessao: SessaoTenant, id: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx.update(servico).set({ ativo: true }).where(eq(servico.id, id));
  });
}

/**
 * Reajuste em massa: aplica `pct`% sobre o valor de todos os serviços ATIVOS do tenant (conveniência
 * do aumento anual). Só toca o catálogo — nunca orçamentos já feitos. `afetados` = quantos mudaram.
 */
export function reajustarPrecos(
  database: Database,
  sessao: SessaoTenant,
  pct: number,
): Promise<{ afetados: number }> {
  if (!pctReajusteValido(pct)) {
    throw new DadosInvalidosError("Percentual de reajuste inválido.");
  }
  return database.withTenant(sessao.tenantId, async (tx) => {
    const ativos = await tx
      .select({ id: servico.id, valorCentavos: servico.valorCentavos })
      .from(servico)
      .where(eq(servico.ativo, true));
    for (const s of ativos) {
      await tx
        .update(servico)
        .set({ valorCentavos: aplicarReajuste(s.valorCentavos, pct) })
        .where(eq(servico.id, s.id));
    }
    return { afetados: ativos.length };
  });
}
```

- [ ] **Step 4: Rodar (deve passar) + typecheck**

Run: `pnpm test src/application/__tests__/servico.test.ts && pnpm typecheck`
Expected: PASS, sem erros. (`sql`/`and` importados podem sobrar — remova o que o lint apontar; se não usar, retire do import.)

- [ ] **Step 5: Commit**

```bash
git add src/application/servico.ts src/application/__tests__/servico.test.ts
git commit -m "feat(servico): aplicação — CRUD + reajuste em massa, isolado por tenant (P-2 fatia 3)"
```

---

## Task 4: Composição + tela /servicos + nav

**Files:**
- Create: `src/infra/composition/servico.ts`
- Create: `src/app/servicos/page.tsx`, `src/app/servicos/editor-servicos.tsx`, `src/app/servicos/actions.ts`, `src/app/servicos/reajuste-modal.tsx`
- Modify: `src/ui/components/app-shell.tsx`

**Interfaces:**
- Consumes: aplicação da Task 3; `TIPOS_ITEM`/`ROTULO_TIPO_ITEM`/`TipoItem` (`@/domain/orcamento/orcamento`); `pode`/`Acao` (`@/domain/auth/rbac`); `sessaoAtual` (`@/infra/auth/sessao`); `moeda` (`@/ui/format`).
- Produces: `listarServicosNoTenant`, `criarServicoNoTenant`, `editarServicoNoTenant`, `desativarServicoNoTenant`, `reativarServicoNoTenant`, `reajustarPrecosNoTenant`, e o tipo `ServicoView` reexportado.

- [ ] **Step 1: Composição**

Create `src/infra/composition/servico.ts`:

```typescript
import type { SessaoTenant } from "@/application/abrir-os";
import {
  criarServico,
  desativarServico,
  editarServico,
  listarServicos,
  reajustarPrecos,
  reativarServico,
  type ServicoInput,
  type ServicoView,
} from "@/application/servico";
import { database } from "@/infra/db/client";

/** Composição do catálogo (P-2): liga os casos de uso ao tenant corrente. A web importa daqui. */

export type { ServicoView };

export function listarServicosNoTenant(
  sessao: SessaoTenant,
  opts?: { incluirInativos?: boolean },
): Promise<ServicoView[]> {
  return listarServicos(database, sessao, opts);
}
export function criarServicoNoTenant(sessao: SessaoTenant, input: ServicoInput) {
  return criarServico(database, sessao, input);
}
export function editarServicoNoTenant(sessao: SessaoTenant, id: string, input: ServicoInput) {
  return editarServico(database, sessao, id, input);
}
export function desativarServicoNoTenant(sessao: SessaoTenant, id: string) {
  return desativarServico(database, sessao, id);
}
export function reativarServicoNoTenant(sessao: SessaoTenant, id: string) {
  return reativarServico(database, sessao, id);
}
export function reajustarPrecosNoTenant(sessao: SessaoTenant, pct: number) {
  return reajustarPrecos(database, sessao, pct);
}
```

- [ ] **Step 2: Server actions (RBAC no boundary)**

Create `src/app/servicos/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { type Acao, pode } from "@/domain/auth/rbac";
import { TIPOS_ITEM, type TipoItem } from "@/domain/orcamento/orcamento";
import { DadosInvalidosError } from "@/domain/shared/errors";
import { type SessaoUsuario, sessaoAtual } from "@/infra/auth/sessao";
import {
  criarServicoNoTenant,
  desativarServicoNoTenant,
  editarServicoNoTenant,
  reajustarPrecosNoTenant,
  reativarServicoNoTenant,
} from "@/infra/composition/servico";

/** Autorização no boundary: o catálogo é gerido por quem edita orçamento (dono/gestor/recepção). */
async function autorizar(acao: Acao): Promise<{ sessao: SessaoUsuario } | { erro: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { erro: "Sua sessão expirou. Entre novamente." };
  }
  if (!pode(sessao.papel, acao)) {
    return { erro: "Você não tem permissão para gerenciar o catálogo." };
  }
  return { sessao };
}

export interface ResultadoAcao {
  ok: boolean;
  motivo?: string;
}

/** Converte reais ("150" / "150,50") em centavos inteiros. Sem separador de milhar. */
function reaisParaCentavos(bruto: string): number | null {
  const v = bruto.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(v)) {
    return null;
  }
  return Math.round(Number.parseFloat(v) * 100);
}

function lerInput(
  tipo: string,
  nome: string,
  valor: string,
  markup: string,
): { nome: string; tipo: TipoItem; valorCentavos: number; markupPct: number } | { erro: string } {
  if (!TIPOS_ITEM.includes(tipo as TipoItem)) {
    return { erro: "Tipo inválido." };
  }
  if (!nome.trim()) {
    return { erro: "Dê um nome ao serviço." };
  }
  const valorCentavos = reaisParaCentavos(valor);
  if (valorCentavos === null) {
    return { erro: "Valor inválido." };
  }
  const markupPct = markup.trim() === "" ? 0 : Number.parseInt(markup, 10);
  if (!Number.isInteger(markupPct) || markupPct < 0) {
    return { erro: "Markup inválido." };
  }
  return { nome, tipo: tipo as TipoItem, valorCentavos, markupPct };
}

export async function acaoCriarServico(tipo: string, nome: string, valor: string, markup: string): Promise<ResultadoAcao> {
  const auth = await autorizar("orcamento:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  const input = lerInput(tipo, nome, valor, markup);
  if ("erro" in input) return { ok: false, motivo: input.erro };
  try {
    await criarServicoNoTenant(auth.sessao, input);
    revalidatePath("/servicos");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível criar o serviço." };
  }
}

export async function acaoEditarServico(id: string, tipo: string, nome: string, valor: string, markup: string): Promise<ResultadoAcao> {
  const auth = await autorizar("orcamento:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  const input = lerInput(tipo, nome, valor, markup);
  if ("erro" in input) return { ok: false, motivo: input.erro };
  try {
    await editarServicoNoTenant(auth.sessao, id, input);
    revalidatePath("/servicos");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível salvar o serviço." };
  }
}

export async function acaoDesativarServico(id: string): Promise<ResultadoAcao> {
  const auth = await autorizar("orcamento:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await desativarServicoNoTenant(auth.sessao, id);
    revalidatePath("/servicos");
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível desativar." };
  }
}

export async function acaoReativarServico(id: string): Promise<ResultadoAcao> {
  const auth = await autorizar("orcamento:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await reativarServicoNoTenant(auth.sessao, id);
    revalidatePath("/servicos");
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível reativar." };
  }
}

export interface ResultadoReajuste {
  ok: boolean;
  motivo?: string;
  afetados?: number;
}

export async function acaoReajustar(pctBruto: string): Promise<ResultadoReajuste> {
  const auth = await autorizar("orcamento:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  const pct = Number.parseInt(pctBruto, 10);
  if (!Number.isInteger(pct)) {
    return { ok: false, motivo: "Informe um percentual inteiro (ex.: 10 ou -5)." };
  }
  try {
    const { afetados } = await reajustarPrecosNoTenant(auth.sessao, pct);
    revalidatePath("/servicos");
    return { ok: true, afetados };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível reajustar." };
  }
}
```

- [ ] **Step 3: Item "Serviços" na nav**

Modify `src/ui/components/app-shell.tsx` — no array `NAV`, adicionar após o item de OS (`{ href: "/os", rotulo: "OS" }`):

```typescript
  { href: "/servicos", rotulo: "Serviços" },
```

(O RBAC real está no redirect da página; a nav é visível a todos, mas quem não pode cai no redirect. Se o padrão do projeto condicionar o item por papel, siga-o — mas o mínimo é adicionar o item, já que `orcamento:editar` inclui recepção, que é a maioria dos operadores.)

- [ ] **Step 4: A página /servicos**

Create `src/app/servicos/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { pode } from "@/domain/auth/rbac";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarServicosNoTenant } from "@/infra/composition/servico";
import { AppShell } from "@/ui/components/app-shell";
import { CabecalhoTela } from "@/ui/components/cabecalho-tela";
import { EditorServicos } from "./editor-servicos";

export const metadata: Metadata = {
  title: "Serviços — Igni",
};

export default async function ServicosPage() {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }
  if (!pode(sessao.papel, "orcamento:editar")) {
    redirect("/");
  }
  const servicos = await listarServicosNoTenant(sessao, { incluirInativos: true });

  return (
    <AppShell>
      <CabecalhoTela
        etiqueta="Cadastro"
        titulo="Serviços"
        sub="Sua tabela de preços. Cadastre os serviços que a oficina faz e o preço de cada um — no orçamento, é só escolher em vez de digitar tudo de novo."
      />
      <div className="max-w-3xl">
        <EditorServicos servicos={servicos} />
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 5: O editor client (agrupado por tipo, CRUD, reajuste)**

Create `src/app/servicos/editor-servicos.tsx` — client component. Deve:
- Agrupar `servicos` por `tipo` (usar `TIPOS_ITEM` + `ROTULO_TIPO_ITEM` de `@/domain/orcamento/orcamento`), cada grupo com seus itens (ativos e, mais apagados, os inativos com botão "Reativar").
- Cada linha: nome + `moeda(valorCentavos)` (de `@/ui/format`) + markup (se > 0, "+X%") + botões editar/desativar (ou reativar).
- Um formulário "Novo serviço" (tipo select, nome, valor R$, markup %) chamando `acaoCriarServico`.
- Um botão "Reajustar todos" que abre o `ReajusteModal`.
- Padrão de estado: `useTransition` + `router.refresh()` + erro em `role="alert"` (imite `src/app/config/estacoes/editor-estacoes.tsx`). Edição inline como no editor de estações.

Create `src/app/servicos/reajuste-modal.tsx` — client. Modal que:
- Pede o percentual (input numérico, aceita negativo), mostra um aviso "Vai mudar os preços de todos os serviços ativos."
- Ao confirmar, chama `acaoReajustar(pct)`; no sucesso mostra "N serviços reajustados" e fecha; no erro, o motivo.
- Fecha no Escape (imite `src/app/os/[id]/modal-aprovacao.tsx`).

> Este step é UI seguindo padrões existentes; o implementer deve escrever o TSX completo imitando `editor-estacoes.tsx` (CRUD inline + useTransition) e `modal-aprovacao.tsx` (modal + Escape). Sem placeholders no arquivo final.

- [ ] **Step 6: Verificar**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: sem erros; a rota `/servicos` monta; boundary guard passa (nada em `src/app` importa `database`).

- [ ] **Step 7: Commit**

```bash
git add src/infra/composition/servico.ts src/app/servicos/ src/ui/components/app-shell.tsx
git commit -m "feat(servico): tela /servicos (CRUD agrupado + reajuste) + composição + nav (P-2 fatia 4)"
```

---

## Task 5: Integração no orçamento ("Do catálogo")

**Files:**
- Create: `src/app/os/[id]/seletor-catalogo.tsx`
- Modify: `src/app/os/[id]/orcamento.tsx`
- Modify: `src/app/os/[id]/page.tsx`

**Interfaces:**
- Consumes: `listarServicosNoTenant` (composição); `ServicoView`; `ItemFormulario` (de `../actions` — `{ tipo, descricao, valor, markup }`, todos string exceto tipo).
- Produces: o builder ganha um botão "Do catálogo" que faz `push` de um `ItemFormulario` preenchido.

- [ ] **Step 1: Carregar o catálogo no detalhe da OS**

Modify `src/app/os/[id]/page.tsx` — onde já carrega `orcamentoDaOs` e `listarEstacoesNoTenant` num `Promise.all`, adicionar `listarServicosNoTenant(sessao)` (só ativos) e passar `servicos` ao componente `Orcamento`:

```typescript
import { listarServicosNoTenant } from "@/infra/composition/servico";
// ...
const [orcamento, estacoes, servicos] = await Promise.all([
  orcamentoDaOs(sessao, id),
  listarEstacoesNoTenant(sessao),
  listarServicosNoTenant(sessao),
]);
// ...
<Orcamento osId={os.id} estado={os.estado} cqAprovado={os.cqAprovado} orcamento={orcamento} podeEditar={podeEditarOrcamento} servicos={servicos} />
```

- [ ] **Step 2: O seletor do catálogo (client)**

Create `src/app/os/[id]/seletor-catalogo.tsx`:

```typescript
"use client";

import { useState } from "react";
import { ROTULO_TIPO_ITEM, TIPOS_ITEM } from "@/domain/orcamento/orcamento";
import type { ServicoView } from "@/infra/composition/servico";

/** Converte centavos → string de reais no formato do input do builder ("1234" centavos → "12,34"). */
function centavosParaReais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

/**
 * Seletor "Do catálogo": lista os serviços ATIVOS agrupados por tipo; escolher um chama `onEscolher`
 * com os dados prontos para virar uma LINHA do builder (o preço é sugestão — a linha fica editável).
 */
export function SeletorCatalogo({
  servicos,
  onEscolher,
  onFechar,
}: {
  servicos: ServicoView[];
  onEscolher: (item: { tipo: string; descricao: string; valor: string; markup: string }) => void;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const filtro = busca.trim().toLowerCase();
  const visiveis = servicos.filter((s) => s.ativo && s.nome.toLowerCase().includes(filtro));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Escolher do catálogo"
      className="fixed inset-0 z-50 grid place-items-center bg-grafite-900/80 p-4"
      onClick={onFechar}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-grafite-600 bg-grafite-850 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg text-aco-100">Do catálogo</h2>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar serviço"
          placeholder="Buscar serviço"
          className="mt-3 rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
        />
        <div className="mt-3 flex-1 overflow-y-auto">
          {visiveis.length === 0 ? (
            <p className="py-6 text-center font-body text-sm text-aco-400">
              Nenhum serviço no catálogo. Cadastre em Serviços.
            </p>
          ) : (
            TIPOS_ITEM.map((tipo) => {
              const doTipo = visiveis.filter((s) => s.tipo === tipo);
              if (doTipo.length === 0) return null;
              return (
                <div key={tipo} className="mb-3">
                  <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-aco-400">
                    {ROTULO_TIPO_ITEM[tipo]}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {doTipo.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() =>
                            onEscolher({
                              tipo: s.tipo,
                              descricao: s.nome,
                              valor: centavosParaReais(s.valorCentavos),
                              markup: String(s.markupPct),
                            })
                          }
                          className="flex w-full items-center justify-between gap-3 rounded-md border border-grafite-700 bg-grafite-800 px-3 py-2 text-left font-body text-sm text-aco-100 transition-colors hover:border-ambar-500"
                        >
                          <span>
                            {s.nome}
                            {s.markupPct > 0 ? (
                              <span className="ml-1 font-mono text-xs text-aco-400">+{s.markupPct}%</span>
                            ) : null}
                          </span>
                          <span className="font-mono tabular-nums text-aco-300">
                            {(s.valorCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="mt-4 rounded-md px-4 py-2 font-body text-sm text-aco-400 hover:text-aco-100"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Ligar no builder**

Modify `src/app/os/[id]/orcamento.tsx`:
- Adicionar `servicos: ServicoView[]` às `Props` (importar `type { ServicoView } from "@/infra/composition/servico"`).
- Importar `SeletorCatalogo` e adicionar estado `const [catalogoAberto, setCatalogoAberto] = useState(false);`.
- Ao lado do "+ Adicionar item", adicionar um botão "+ Do catálogo" (só quando `editavel`) que faz `setCatalogoAberto(true)`.
- Renderizar `{catalogoAberto ? <SeletorCatalogo servicos={servicos} onEscolher={(item) => { setLinhas((ls) => [...ls, item]); setCatalogoAberto(false); }} onFechar={() => setCatalogoAberto(false)} /> : null}`.

O `onEscolher` recebe exatamente um `ItemFormulario` (`{tipo, descricao, valor, markup}`), então o `push` em `setLinhas` é direto. **`montarOrcamento` e o formato das linhas NÃO mudam.**

- [ ] **Step 4: Verificar**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: sem erros; o detalhe da OS monta com o seletor.

- [ ] **Step 5: Commit**

```bash
git add "src/app/os/[id]/"
git commit -m "feat(servico): botão 'Do catálogo' no orçamento preenche a linha (P-2 fatia 5)"
```

---

## Task 6: Pipeline + deploy

**Files:** nenhuma nova — publica.

- [ ] **Step 1: Pipeline completo local**

Run: `docker start igni-db` && `pnpm typecheck && pnpm lint && pnpm build && pnpm test`
Expected: verdes. (Se `demonstracao.test.ts` falhar por `DATABASE_URL` ausente no shell, é pré-existente/ambiente — confirme com `git stash` que falha no main também; não é regressão.)

- [ ] **Step 2: Commit/push + CI verde**

```bash
git push origin main   # (ou merge da branch, conforme o fluxo escolhido)
```
Aguarde `gh run list --branch main --limit 1 --json status,conclusion` ficar **success**. Se falhar, leia `gh run view <id> --log-failed`, corrija, repita.

- [ ] **Step 3: Migration no cloud + deploy**

Aplicar a migration no cloud ANTES do deploy do código que usa `servico` (DATABASE_URL do bloco CLOUD do `.env`):

Run: `pnpm db:migrate`
Expected: "migrations applied successfully". Verifique a tabela `servico` + RLS/policy no cloud (query em `information_schema` / `pg_policies`).

Run: `railway up --service igni-app --ci`
Expected: "Deploy complete".

- [ ] **Step 4: Smoke test (curl, sem Playwright)**

Verifique:
- `/login` → 200; `/servicos` → 307 → /login (protegida).
- Após login (manual/dev), `/servicos` mostra o catálogo e o orçamento tem o botão "Do catálogo".

- [ ] **Step 5: Docs**

Modify `docs/00_status.md` e `docs/15_backlog_produto.md` (marcar P-2 do backlog como no ar). Commit + push.

---

## Self-Review

**1. Spec coverage:**
- Tabela `servico` por tenant + RLS → Task 1. ✅
- Preço = sugestão (sem FK, `montarOrcamento` intocado) → Task 5 (o "Do catálogo" só faz `push` de linha; nenhuma FK criada). ✅
- Reusa enum `tipo_item_orcamento` → Task 1 (schema) + Task 3/5 (usa `TipoItem`). ✅
- `validarServico` + `aplicarReajuste` (arredonda ao centavo) → Task 2. ✅
- CRUD + desativar/reativar + reajuste (só ativos, com validação de pct) → Task 3. ✅
- Tela `/servicos` agrupada por tipo + reajuste com confirmação + nav → Task 4. ✅
- RBAC `orcamento:editar` → Task 4 (actions autorizam). ✅
- "Do catálogo" no builder (copia pra linha editável) → Task 5. ✅
- Isolamento multi-tenant testado → Tasks 1 e 3. ✅
- Reajuste com **confirmação** na UX → Task 4 (o `ReajusteModal` confirma). ✅

**2. Placeholder scan:** Os Steps de UI (Task 4 Step 5) descrevem o componente e mandam imitar arquivos concretos existentes (`editor-estacoes.tsx`, `modal-aprovacao.tsx`) em vez de colar 200 linhas de TSX — isso é aceitável para UI que segue um padrão já estabelecido no repo, mas o implementer DEVE produzir o TSX completo, sem `TODO`. Os Steps de lógica (Tasks 1-3, 5) têm código completo. Nenhum `TBD`.

**3. Type consistency:** `ServicoView` tem os mesmos campos em aplicação (Task 3), composição (Task 4) e UI (Tasks 4-5). `ServicoInput` = `{nome, tipo, valorCentavos, markupPct}` consistente. O `onEscolher` do seletor produz exatamente `ItemFormulario` (`{tipo, descricao, valor, markup}`) que o builder já usa. `aplicarReajuste`/`pctReajusteValido`/`validarServico` têm as mesmas assinaturas em Task 2 (def) e Task 3 (uso).

**Nota de escopo:** o reajuste em massa itera e faz N updates (um por serviço ativo) numa transação — simples e correto para catálogos de dezenas de itens (o caso real). Se um tenant tiver milhares de serviços, valeria um único `UPDATE ... SET valor = round(...)`; fora de escopo agora (YAGNI), registrado como nota.
