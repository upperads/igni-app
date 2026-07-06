# Conta a receber por OS (P-4a) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao aprovar o orçamento, nasce uma conta a receber com o total; ela tem linha do tempo própria (aberta/recebida/cancelada), acompanha o orçamento enquanto aberta, congela se recebida, e pode ser cancelada pela gestão — mostrada no detalhe da OS.

**Architecture:** Tabela nova `conta_receber` por tenant (RLS). O `aprovarOrcamento` (já existe) passa a criar/atualizar a conta na mesma transação, calculando o total via `calcularOrcamento`. Máquina de estados do dinheiro no domínio. Uma permissão nova `financeiro:gerir` (P-1) restringe "cancelar cobrança" à gestão/financeiro. Bloco Financeiro no detalhe da OS.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Drizzle ORM + Postgres (Supabase), RLS multi-tenant via `withTenant`, Tailwind v4, Vitest.

## Global Constraints

- **TypeScript strict, zero `any`.** Lint estrito (boundary guard: `src/app` NUNCA importa `@/infra/db/client`).
- **Dinheiro SEMPRE em centavos inteiros.**
- **Isolamento multi-tenant sempre** (regra de ouro #7): tabela nova tem `tenant_id` + RLS **na mesma migration**; testado A↔B.
- **Migrations só via Drizzle** (`drizzle-kit generate` para o schema; RLS e migração de dados escritas à mão). Migration cloud: `railway run --service igni-app pnpm db:migrate` (a `DATABASE_URL` do cloud vive nos secrets do Railway; o `.env` local aponta para `127.0.0.1:5442x`).
- **SEM Playwright.** Verificação por typecheck/lint/build/test + curl.
- **CI verde antes do deploy.** Deploy: `railway up --service igni-app --ci`. Commit/push junto (o `git push` mostra um stderr no PowerShell que é SUCESSO — usar Bash).
- **Commits Conventional**; a mensagem termina com: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Catálogo de permissões (P-1) — exato hoje (10):** `os:abrir`, `os:editar`, `os:avancar`, `triagem:override`, `orcamento:editar`, `dinheiro:ver`, `dinheiro:ver_peca`, `cadastro:editar`, `equipe:gerir`, `config:editar`. **`financeiro:gerir` vira a 11ª.**
- **`aprovarOrcamento` NÃO avança a OS** (só libera o gate) — manter; só ADICIONAR a lógica da conta.
- **Máquina de estados do dinheiro (exata):** `aberta`→`recebida`/`cancelada`; `cancelada`→`aberta`; `recebida` é terminal.
- **Regra do gatilho:** sem conta→cria `aberta` com total; conta `aberta`→atualiza valor; `recebida`→não toca; `cancelada`→reabre (volta a `aberta` com novo total).

---

## Estrutura de arquivos

**Criados:**
- `src/infra/db/schema/conta-receber.ts` — tabela `conta_receber`.
- `src/infra/db/migrations/00XX_*.sql` — CREATE TABLE + enum status_conta (gerado).
- `src/infra/db/migrations/00YY_rls_conta_receber.sql` — RLS (à mão).
- `src/infra/db/migrations/00ZZ_seed_financeiro_gerir.sql` — migração de dados: `financeiro:gerir` nos cargos Dono/Gestor/Financeiro (à mão).
- `src/domain/financeiro/conta.ts` — `STATUS_CONTA`, `validarTransicaoConta`.
- `src/domain/financeiro/__tests__/conta.test.ts` — testes do domínio (máquina + drift).
- `src/application/conta.ts` — `cancelarConta`, `contaDaOs`.
- `src/application/__tests__/conta.test.ts` — testes de aplicação (isolamento, casos da máquina, gatilho).
- `src/infra/composition/conta.ts` — wrappers `*NoTenant`.
- `src/infra/db/__tests__/conta-receber-isolation.test.ts` — isolamento RLS A↔B.
- `src/app/os/[id]/financeiro.tsx` — bloco Financeiro (client).

**Modificados:**
- `src/infra/db/schema/enums.ts` — `statusConta` pgEnum.
- `src/infra/db/schema/index.ts` — exporta `contaReceber`.
- `src/domain/auth/cargo.ts` — `financeiro:gerir` no catálogo, PROIBIDAS_NO_CHAO, cargos-semente.
- `src/domain/auth/__tests__/cargo.test.ts` — 10→11 chaves; casos de `financeiro:gerir`.
- `src/application/orcamento.ts` — `aprovarOrcamento` cria/atualiza a conta.
- `src/application/__tests__/orcamento.test.ts` — regressão + conta nasce ao aprovar (se o teste existir; senão os casos vão no conta.test).
- `src/app/os/[id]/page.tsx` — lê `contaDaOsNoTenant`, passa ao bloco.
- `src/app/os/[id]/actions.ts` — `acaoCancelarCobranca`.

---

## Task 1: Schema `conta_receber` + enum + RLS + domínio + `financeiro:gerir`

**Files:**
- Create: `src/infra/db/schema/conta-receber.ts`
- Modify: `src/infra/db/schema/enums.ts`, `src/infra/db/schema/index.ts`
- Create (gerado): `src/infra/db/migrations/00XX_*.sql`
- Create (à mão): `src/infra/db/migrations/00YY_rls_conta_receber.sql`, `src/infra/db/migrations/00ZZ_seed_financeiro_gerir.sql`
- Create: `src/domain/financeiro/conta.ts`, `src/domain/financeiro/__tests__/conta.test.ts`
- Modify: `src/domain/auth/cargo.ts`, `src/domain/auth/__tests__/cargo.test.ts`
- Create: `src/infra/db/__tests__/conta-receber-isolation.test.ts`

**Interfaces:**
- Produces: tabela `contaReceber`; enum `statusConta`; `STATUS_CONTA`/`type StatusConta`/`validarTransicaoConta(de,para)` de `@/domain/financeiro/conta`; `financeiro:gerir` no catálogo.

- [ ] **Step 1: enum `status_conta`**

Em `src/infra/db/schema/enums.ts`, adicionar (junto dos outros pgEnum):
```typescript
/** Status da conta a receber (P-4a): linha do tempo do dinheiro. Espelha `STATUS_CONTA` do domínio (drift). */
export const statusConta = pgEnum("status_conta", ["aberta", "recebida", "cancelada"]);
```

- [ ] **Step 2: schema `conta_receber`**

`src/infra/db/schema/conta-receber.ts`:
```typescript
import { integer, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { statusConta } from "./enums";
import { orcamento } from "./orcamento";
import { os } from "./os";
import { tenant } from "./tenant";

/**
 * Conta a receber (P-4a): nasce quando o orçamento é aprovado, com o total capturado no momento.
 * Linha do tempo do dinheiro (aberta→recebida/cancelada), independente do estado físico da OS.
 * Uma por orçamento (unique). Config por tenant, com RLS.
 */
export const contaReceber = pgTable(
  "conta_receber",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    osId: uuid("os_id")
      .notNull()
      .references(() => os.id, { onDelete: "cascade" }),
    orcamentoId: uuid("orcamento_id")
      .notNull()
      .references(() => orcamento.id, { onDelete: "cascade" }),
    valorCentavos: integer("valor_centavos").notNull(),
    status: statusConta("status").notNull().default("aberta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("conta_receber_orcamento_unico").on(t.orcamentoId)],
);
```

- [ ] **Step 3: exportar no barrel**

Em `src/infra/db/schema/index.ts`:
```typescript
export * from "./conta-receber";
```

- [ ] **Step 4: gerar a migration do schema**

Confira o maior número em `src/infra/db/migrations/` (hoje 0031). Run: `pnpm drizzle-kit generate`
Expected: cria `00XX` (0032) com `CREATE TYPE "status_conta"`, `CREATE TABLE "conta_receber"`, os 3 FKs e o unique `conta_receber_orcamento_unico`. Anote 00XX e os próximos livres 00YY, 00ZZ.

- [ ] **Step 5: RLS (à mão)**

`src/infra/db/migrations/00YY_rls_conta_receber.sql`:
```sql
-- RLS multi-tenant da conta a receber (P-4a). Mesmo padrão do 0023_rls_cargo:
-- GRANT ao app_user + ENABLE (SEM FORCE) + política de isolamento por tenant.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "conta_receber" TO app_user;--> statement-breakpoint

ALTER TABLE "conta_receber" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY conta_receber_tenant_isolation ON "conta_receber"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
```

- [ ] **Step 6: migração de dados — `financeiro:gerir` nos cargos (à mão)**

`src/infra/db/migrations/00ZZ_seed_financeiro_gerir.sql`:
```sql
-- P-4a: adiciona a permissão 'financeiro:gerir' aos cargos-sistema Dono/Gestor/Financeiro de TODOS
-- os tenants (que já existem do seed do P-1). Idempotente via NOT (... = ANY(permissoes)).
UPDATE "cargo"
SET permissoes = array_append(permissoes, 'financeiro:gerir')
WHERE sistema = true
  AND nome IN ('Dono', 'Gestor', 'Financeiro')
  AND NOT ('financeiro:gerir' = ANY(permissoes));
```

- [ ] **Step 7: registrar migrations manuais no journal + aplicar**

Adicione as entradas de 00YY e 00ZZ ao `src/infra/db/migrations/meta/_journal.json` (idx incremental, `when` incremental, `tag` = nome sem `.sql`, `breakpoints: true`) — replicando como 0023/0024 estão registrados.
Run: `pnpm db:migrate`
Expected: aplica 00XX/00YY/00ZZ sem erro.

- [ ] **Step 8: domínio `conta.ts` + teste (RED→GREEN)**

`src/domain/financeiro/__tests__/conta.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { statusConta } from "@/infra/db/schema/enums";
import { STATUS_CONTA, validarTransicaoConta } from "@/domain/financeiro/conta";
import { DadosInvalidosError } from "@/domain/shared/errors";

describe("financeiro — conta (máquina de estados do dinheiro)", () => {
  it("o enum do banco espelha STATUS_CONTA (drift)", () => {
    expect([...STATUS_CONTA].sort()).toEqual([...statusConta.enumValues].sort());
  });

  it("aberta → recebida | cancelada", () => {
    expect(() => validarTransicaoConta("aberta", "recebida")).not.toThrow();
    expect(() => validarTransicaoConta("aberta", "cancelada")).not.toThrow();
  });

  it("cancelada → aberta (reaprovação)", () => {
    expect(() => validarTransicaoConta("cancelada", "aberta")).not.toThrow();
  });

  it("recebida é terminal (rejeita qualquer transição)", () => {
    expect(() => validarTransicaoConta("recebida", "aberta")).toThrow(DadosInvalidosError);
    expect(() => validarTransicaoConta("recebida", "cancelada")).toThrow(DadosInvalidosError);
  });

  it("rejeita transições sem sentido", () => {
    expect(() => validarTransicaoConta("aberta", "aberta")).toThrow(DadosInvalidosError);
    expect(() => validarTransicaoConta("cancelada", "recebida")).toThrow(DadosInvalidosError);
  });
});
```
`src/domain/financeiro/conta.ts`:
```typescript
import { DadosInvalidosError } from "@/domain/shared/errors";

/** Status da conta a receber (P-4a). Espelha o enum `status_conta` do banco (teste de drift). */
export const STATUS_CONTA = ["aberta", "recebida", "cancelada"] as const;
export type StatusConta = (typeof STATUS_CONTA)[number];

/** Transições permitidas do dinheiro. `recebida` é terminal (congela). */
const TRANSICOES: Record<StatusConta, readonly StatusConta[]> = {
  aberta: ["recebida", "cancelada"],
  cancelada: ["aberta"],
  recebida: [],
};

/** Valida uma transição de status da conta. Lança DadosInvalidosError se inválida. */
export function validarTransicaoConta(de: StatusConta, para: StatusConta): void {
  if (!TRANSICOES[de].includes(para)) {
    throw new DadosInvalidosError(`Transição de conta inválida: ${de} → ${para}.`);
  }
}
```
Run: `pnpm test src/domain/financeiro/__tests__/conta.test.ts` → RED (módulo não existe) → GREEN após escrever `conta.ts`.

- [ ] **Step 9: `financeiro:gerir` no catálogo, pisos e cargos-semente**

Em `src/domain/auth/cargo.ts`:
- Adicionar `"financeiro:gerir"` ao array `PERMISSOES` (após `config:editar` — vira a 11ª).
- Adicionar `"financeiro:gerir"` a `PROIBIDAS_NO_CHAO`:
```typescript
const PROIBIDAS_NO_CHAO: readonly Permissao[] = ["orcamento:editar", "dinheiro:ver", "dinheiro:ver_peca", "financeiro:gerir"];
```
- NÃO adicionar a `GATILHOS_2FA` (Piso 3: financeiro:gerir não força 2FA).
- Nos `CARGOS_SEMENTE`, adicionar `"financeiro:gerir"` às permissões de **Dono**, **Gestor** e **Financeiro** (não os outros).

- [ ] **Step 10: atualizar o teste de cargo**

Em `src/domain/auth/__tests__/cargo.test.ts`:
- O teste "o catálogo tem exatamente as 10 chaves" passa a esperar **11** — adicionar `"financeiro:gerir"` à lista esperada.
- Adicionar um caso: `validarCargo({ nome: "X", chao: true, permissoes: ["financeiro:gerir"] })` **lança** (Piso 2).
- Se o teste de drift de cargos-semente valida permissões específicas de Dono/Gestor/Financeiro, incluir `financeiro:gerir`.

Run: `pnpm test src/domain/auth/__tests__/cargo.test.ts` → todos passam.

- [ ] **Step 11: teste de isolamento A↔B**

`os_id`/`orcamento_id` são NOT NULL, então o teste cria uma OS real via `abrirOS` (o caso de uso, como faz `orcamento.test.ts`) + um orçamento por tenant, e insere a conta apontando para eles. `abrirOS` recebe `SessaoTenant` e um input com cliente/equipamento/entrada e cria tudo. `src/infra/db/__tests__/conta-receber-isolation.test.ts`:
```typescript
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abrirOS } from "@/application/abrir-os";
import type { Database } from "@/infra/db/connection";
import { cliente, contaReceber, entrada, equipamento, orcamento, os, tenant } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

const INPUT_OS = {
  cliente: { nome: "Cliente", tipo: "avulso" as const },
  equipamento: { tipo: "Motor" },
  entrada: { modalidade: "so_usinagem" as const },
};

/** Cria uma OS + um orçamento no tenant e devolve os ids (para os FKs da conta). */
async function osComOrcamento(database: Database, tenantId: string): Promise<{ osId: string; orcamentoId: string }> {
  const sessao = { tenantId, usuarioId: "00000000-0000-0000-0000-000000000000" };
  const { osId } = await abrirOS(database, sessao, INPUT_OS);
  const [orc] = await database.db.insert(orcamento).values({ tenantId, osId }).returning({ id: orcamento.id });
  return { osId, orcamentoId: orc!.id };
}

describe("isolamento multi-tenant — conta_receber (RLS)", () => {
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
    await database.db.delete(contaReceber);
    await database.db.delete(orcamento);
    await database.db.delete(os);
    await database.db.delete(entrada);
    await database.db.delete(equipamento);
    await database.db.delete(cliente);
    await database.db.delete(tenant);
    const [a] = await database.db.insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db.insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    tenantA = a!.id;
    tenantB = b!.id;
  });

  it("A enxerga apenas a própria conta", async () => {
    const oa = await osComOrcamento(database, tenantA);
    const ob = await osComOrcamento(database, tenantB);
    await database.db.insert(contaReceber).values({ tenantId: tenantA, osId: oa.osId, orcamentoId: oa.orcamentoId, valorCentavos: 15000 });
    await database.db.insert(contaReceber).values({ tenantId: tenantB, osId: ob.osId, orcamentoId: ob.orcamentoId, valorCentavos: 20000 });

    const vistos = await database.withTenant(tenantA, (tx) => tx.select().from(contaReceber));
    expect(vistos).toHaveLength(1);
    expect(vistos[0]!.valorCentavos).toBe(15000);
  });

  it("a RLS barra escrever conta de outro tenant (WITH CHECK)", async () => {
    const ob = await osComOrcamento(database, tenantB);
    await expect(
      database.withTenant(tenantA, (tx) =>
        tx.insert(contaReceber).values({ tenantId: tenantB, osId: ob.osId, orcamentoId: ob.orcamentoId, valorCentavos: 100 }),
      ),
    ).rejects.toThrow();
  });
});
```
> Confirme a assinatura real de `abrirOS` (`src/application/abrir-os.ts`) e do `INPUT_OS` contra `orcamento.test.ts` (que já monta esse input) — ajuste os campos (`tipo` do cliente, `modalidade` da entrada) aos valores válidos reais se divergirem. O objetivo do teste é a RLS da `conta_receber`; a OS/orçamento são só andaimes para os FKs.

- [ ] **Step 12: typecheck + lint + build + testes**

Run: `pnpm typecheck && pnpm lint && pnpm build && pnpm test src/domain/financeiro/__tests__/conta.test.ts src/domain/auth/__tests__/cargo.test.ts src/infra/db/__tests__/conta-receber-isolation.test.ts`
Expected: verdes.

- [ ] **Step 13: Commit**

```bash
git add src/infra/db/schema/ src/infra/db/migrations/ src/domain/financeiro/ src/domain/auth/cargo.ts src/domain/auth/__tests__/cargo.test.ts src/infra/db/__tests__/conta-receber-isolation.test.ts
git commit -m "feat(financeiro): schema conta_receber + RLS + máquina de estados + financeiro:gerir (P-4a fatia 1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Aplicação — `aprovarOrcamento` cria a conta + `cancelarConta` + `contaDaOs`

**Files:**
- Modify: `src/application/orcamento.ts` (o gatilho)
- Create: `src/application/conta.ts` (`cancelarConta`, `contaDaOs`)
- Create: `src/application/__tests__/conta.test.ts`
- Create: `src/infra/composition/conta.ts`

**Interfaces:**
- Consumes: `validarTransicaoConta`, `type StatusConta` de `@/domain/financeiro/conta`; `calcularOrcamento` de `@/domain/orcamento/orcamento`; `contaReceber`, `orcamentoItem` do schema; `SessaoTenant`.
- Produces:
  - `ContaView = { id; status: StatusConta; valorCentavos: number }`.
  - `contaDaOs(database, sessao, osId): Promise<ContaView | null>`.
  - `cancelarConta(database, sessao, contaId): Promise<void>`.
  - (o `aprovarOrcamento` cria/atualiza a conta internamente).

- [ ] **Step 1: escrever os testes de aplicação (RED)**

`src/application/__tests__/conta.test.ts` — cobre: aprovar cria a conta `aberta` com o total; reaprovar atualiza (aberta); não toca (recebida); reabre (cancelada); `cancelarConta` só de aberta; `contaDaOs` leitura; isolamento A↔B. O implementer usa a factory/fluxo de OS+orçamento (montar itens → aprovar) já usada nos testes de orçamento. Casos essenciais:
```typescript
// (setup: tenant + os + orcamento com itens somando um total conhecido, ex.: 15000 centavos)
it("aprovar o orçamento cria a conta aberta com o total", async () => {
  await aprovarOrcamentoNoFluxo(...); // aprova
  const conta = await contaDaOs(database, sessaoA(), osId);
  expect(conta).not.toBeNull();
  expect(conta!.status).toBe("aberta");
  expect(conta!.valorCentavos).toBe(15000);
});

it("reaprovar com conta aberta atualiza o valor", async () => { /* muda itens, reaprova, valor novo */ });

it("conta recebida NÃO é tocada ao reaprovar", async () => { /* seta recebida via db, reaprova, valor congela */ });

it("conta cancelada REABRE ao reaprovar", async () => { /* cancela, reaprova, volta a aberta */ });

it("cancelarConta só funciona de aberta; recebida rejeita", async () => {
  await expect(cancelarConta(database, sessaoA(), contaRecebidaId)).rejects.toThrow(DadosInvalidosError);
});
```
> O implementer escreve as asserções completas usando o fluxo real (montarOrcamento → enviarOrcamento → aprovarOrcamento) ou inserts diretos onde for mais simples. O total esperado vem de `calcularOrcamento` dos itens que ele inserir.

- [ ] **Step 2: rodar (RED)** — `pnpm test src/application/__tests__/conta.test.ts` → FAIL.

- [ ] **Step 3: `aprovarOrcamento` cria/atualiza a conta**

Em `src/application/orcamento.ts`, dentro do `aprovarOrcamento` (após o `update` do status para "aprovado", ainda na mesma transação `tx`), adicionar a lógica da conta. Importar `contaReceber` do schema, `calcularOrcamento` do domínio, e ler os itens do orçamento:
```typescript
    // P-4a: nasce/atualiza a conta a receber com o total aprovado (mesma transação).
    const itens = await tx
      .select({ tipo: orcamentoItem.tipo, valorCentavos: orcamentoItem.valorCentavos, markupPct: orcamentoItem.markupPct })
      .from(orcamentoItem)
      .where(eq(orcamentoItem.orcamentoId, orc.id));
    const { total } = calcularOrcamento(itens);

    const [contaExistente] = await tx
      .select({ id: contaReceber.id, status: contaReceber.status })
      .from(contaReceber)
      .where(eq(contaReceber.orcamentoId, orc.id))
      .limit(1);

    if (!contaExistente) {
      await tx.insert(contaReceber).values({
        tenantId: sessao.tenantId,
        osId,
        orcamentoId: orc.id,
        valorCentavos: total,
        status: "aberta",
      });
    } else if (contaExistente.status === "aberta") {
      await tx.update(contaReceber).set({ valorCentavos: total }).where(eq(contaReceber.id, contaExistente.id));
    } else if (contaExistente.status === "cancelada") {
      await tx.update(contaReceber).set({ valorCentavos: total, status: "aberta" }).where(eq(contaReceber.id, contaExistente.id));
    }
    // status === "recebida" → não toca (congela).
```
Adicionar os imports no topo do `orcamento.ts`: `contaReceber` ao import do schema, `calcularOrcamento` ao import de `@/domain/orcamento/orcamento`. O comportamento existente (update do status + evento de canal) permanece intacto.

- [ ] **Step 4: `conta.ts` (aplicação) — cancelarConta + contaDaOs**

`src/application/conta.ts`:
```typescript
import { eq } from "drizzle-orm";
import { type StatusConta, validarTransicaoConta } from "@/domain/financeiro/conta";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { contaReceber } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/** Conta a receber de uma OS (P-4a): leitura + cancelamento. A criação vive no aprovarOrcamento. */
export interface ContaView {
  id: string;
  status: StatusConta;
  valorCentavos: number;
}

/** A conta a receber da OS (via orçamento). Null se ainda não há (orçamento não aprovado). */
export function contaDaOs(database: Database, sessao: SessaoTenant, osId: string): Promise<ContaView | null> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [c] = await tx
      .select({ id: contaReceber.id, status: contaReceber.status, valorCentavos: contaReceber.valorCentavos })
      .from(contaReceber)
      .where(eq(contaReceber.osId, osId))
      .limit(1);
    return c ?? null;
  });
}

/** Cancela a cobrança (aberta → cancelada). Só de aberta (validarTransicaoConta). Gestão/financeiro. */
export function cancelarConta(database: Database, sessao: SessaoTenant, contaId: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [c] = await tx.select({ status: contaReceber.status }).from(contaReceber).where(eq(contaReceber.id, contaId)).limit(1);
    if (!c) {
      throw new DadosInvalidosError("Conta não encontrada.");
    }
    validarTransicaoConta(c.status, "cancelada");
    await tx.update(contaReceber).set({ status: "cancelada" }).where(eq(contaReceber.id, contaId));
  });
}
```

- [ ] **Step 5: composição**

`src/infra/composition/conta.ts`:
```typescript
import type { SessaoTenant } from "@/application/abrir-os";
import { cancelarConta, contaDaOs, type ContaView } from "@/application/conta";
import { database } from "@/infra/db/client";

/** Composição da conta a receber (P-4a). A web importa daqui. */
export type { ContaView };

export function contaDaOsNoTenant(sessao: SessaoTenant, osId: string): Promise<ContaView | null> {
  return contaDaOs(database, sessao, osId);
}
export function cancelarContaNoTenant(sessao: SessaoTenant, contaId: string): Promise<void> {
  return cancelarConta(database, sessao, contaId);
}
```

- [ ] **Step 6: rodar (verde) + regressão**

Run: `pnpm test src/application/__tests__/conta.test.ts src/application/__tests__/orcamento.test.ts`
Expected: os novos passam E os de orçamento continuam passando (o `aprovarOrcamento` ainda libera o gate — a regressão é que o comportamento antigo não mudou). Depois `pnpm typecheck && pnpm lint && pnpm build`.

- [ ] **Step 7: Commit**

```bash
git add src/application/orcamento.ts src/application/conta.ts src/application/__tests__/conta.test.ts src/infra/composition/conta.ts
git commit -m "feat(financeiro): aprovarOrcamento cria/atualiza a conta + cancelarConta + contaDaOs (P-4a fatia 2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Bloco Financeiro no detalhe da OS

**Files:**
- Create: `src/app/os/[id]/financeiro.tsx`
- Modify: `src/app/os/[id]/page.tsx`, `src/app/os/[id]/actions.ts`

**Interfaces:**
- Consumes: `contaDaOsNoTenant`, `cancelarContaNoTenant`, `type ContaView` de `@/infra/composition/conta`; `pode` de `@/domain/auth/rbac`; `moeda` de `@/ui/format`.
- Produces: bloco Financeiro na `/os/[id]`; `acaoCancelarCobranca`.

- [ ] **Step 1: action `acaoCancelarCobranca` (RBAC no boundary)**

Em `src/app/os/[id]/actions.ts`, adicionar (seguindo o padrão das actions existentes do arquivo — ver como as outras resolvem sessão + gate):
```typescript
export async function acaoCancelarCobranca(contaId: string): Promise<{ ok: boolean; motivo?: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { ok: false, motivo: "Sua sessão expirou. Entre novamente." };
  }
  if (!pode(sessao.permissoes, "financeiro:gerir")) {
    return { ok: false, motivo: "Você não tem permissão para cancelar cobranças." };
  }
  try {
    await cancelarContaNoTenant(sessao, contaId);
    revalidatePath(`/os/${/* o osId — ver nota */ ""}`);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível cancelar a cobrança." };
  }
}
```
> Ajustes: importar `pode` de `@/domain/auth/rbac`, `cancelarContaNoTenant` de `@/infra/composition/conta`, `sessaoAtual` de `@/infra/auth/sessao`, `DadosInvalidosError`, `revalidatePath`. **revalidatePath:** a action recebe só `contaId`; para revalidar a página da OS, ou (a) receber também o `osId` como 2º parâmetro (preferir — o componente tem o osId), ou (b) revalidar via `revalidatePath("/os", "layout")`. **Decisão do plano:** a action recebe `(contaId: string, osId: string)` e faz `revalidatePath(\`/os/${osId}\`)`. Ajustar a assinatura acima para incluir `osId`.

- [ ] **Step 2: componente `financeiro.tsx`**

`src/app/os/[id]/financeiro.tsx`:
```typescript
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ContaView } from "@/infra/composition/conta";
import { moeda } from "@/ui/format";
import { acaoCancelarCobranca } from "./actions";

const ROTULO: Record<ContaView["status"], string> = {
  aberta: "a receber",
  recebida: "recebido",
  cancelada: "cancelado",
};

const COR: Record<ContaView["status"], string> = {
  aberta: "text-ambar-500",
  recebida: "text-sinal-verde",
  cancelada: "text-aco-500",
};

/**
 * Bloco Financeiro do detalhe da OS (P-4a): mostra a conta a receber (valor + status) e permite
 * CANCELAR a cobrança (só quando aberta E o cargo tem financeiro:gerir). A baixa é P-4b.
 */
export function Financeiro({ conta, osId, podeCancelar }: { conta: ContaView; osId: string; podeCancelar: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function cancelar() {
    setErro(null);
    iniciar(async () => {
      const r = await acaoCancelarCobranca(conta.id, osId);
      if (!r.ok) {
        setErro(r.motivo ?? "Não deu certo.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section aria-label="Financeiro" className="rounded-lg border border-grafite-700 bg-grafite-850 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-aco-400">Financeiro</p>
          <p className="mt-1 font-display text-xl text-aco-100">
            {moeda(conta.valorCentavos)} <span className={`font-body text-sm ${COR[conta.status]}`}>· {ROTULO[conta.status]}</span>
          </p>
        </div>
        {conta.status === "aberta" && podeCancelar ? (
          <button
            type="button"
            onClick={cancelar}
            disabled={pendente}
            className="rounded-md border border-grafite-600 px-3 py-1.5 font-body text-sm text-aco-400 hover:border-sinal-vermelho hover:text-sinal-vermelho disabled:opacity-50"
          >
            Cancelar cobrança
          </button>
        ) : null}
      </div>
      {erro ? <p role="alert" className="mt-2 font-body text-sm text-sinal-vermelho">{erro}</p> : null}
    </section>
  );
}
```

- [ ] **Step 3: ligar na page**

Em `src/app/os/[id]/page.tsx`:
- Adicionar `contaDaOsNoTenant(sessao, id)` ao `Promise.all` existente (que já tem `orcamentoDaOs`, `listarEstacoesNoTenant`, `listarServicosNoTenant`).
- Calcular `const podeVerFinanceiro = pode(sessao.permissoes, "dinheiro:ver");` e `const podeCancelarCobranca = pode(sessao.permissoes, "financeiro:gerir");`.
- Renderizar o bloco **só quando** `podeVerFinanceiro && conta` (importar `Financeiro` de `./financeiro`):
```tsx
{podeVerFinanceiro && conta ? (
  <Financeiro conta={conta} osId={os.id} podeCancelar={podeCancelarCobranca} />
) : null}
```
Posicionar o bloco perto do bloco de Orçamento (decisão de layout do implementer; um lugar natural é logo após a seção de Orçamento). `pode` já é importado na page (de `@/domain/auth/rbac`).

- [ ] **Step 4: typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: verdes. `pnpm test` — nada quebrou.

- [ ] **Step 5: Commit**

```bash
git add src/app/os/[id]/financeiro.tsx src/app/os/[id]/page.tsx src/app/os/[id]/actions.ts
git commit -m "feat(financeiro): bloco Financeiro no detalhe da OS (conta + cancelar cobrança, RBAC) (P-4a fatia 3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Pipeline + deploy

**Files:** nenhum código novo; conduz o merge e o deploy. (Controlador.)

- [ ] **Step 1: Pipeline local** — `pnpm typecheck && pnpm lint && pnpm build && pnpm test`. Verde (Docker fora → confiar no CI para DB).
- [ ] **Step 2: Merge + push** — `git checkout main && git merge --no-ff feat/conta-receber-p4a -m "feat(financeiro): conta a receber por OS (P-4a)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" && git push origin main`.
- [ ] **Step 3: CI verde** — `gh run watch $(gh run list --branch main --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`.
- [ ] **Step 4: Migration cloud** — `railway run --service igni-app pnpm db:migrate`.
- [ ] **Step 5: Verificar no cloud** (script temporário na raiz, removido): tabela `conta_receber` + RLS `true`/force `false` + policy + grants; enum `status_conta` tem os 3 valores; **e o crítico: os cargos-sistema Dono/Gestor/Financeiro de todos os tenants ganharam `financeiro:gerir`** (`SELECT nome, 'financeiro:gerir' = ANY(permissoes) FROM cargo WHERE sistema AND nome IN ('Dono','Gestor','Financeiro')` — todos `true`; e Recepção NÃO tem). Rodar via `railway run --service igni-app node verify-conta.mjs`. Remover.
- [ ] **Step 6: Deploy** — `railway up --service igni-app --ci`.
- [ ] **Step 7: Smoke** — `curl`: `/login` 200; `/os` 307→/login. (O bloco financeiro é interno ao detalhe da OS — o smoke confirma a app no ar.)
- [ ] **Step 8: Docs + branch + memória** — `docs/00_status.md` e `docs/15_backlog_produto.md` (P-4a no ar; P-4b/P-4c seguem); apagar branch; memória `conta-receber-p4a.md` (conta nasce ao aprovar, máquina do dinheiro, financeiro:gerir, valor capturado, cancelar só gestão).

---

## Self-review (feito pelo autor do plano)

**1. Cobertura do spec:**
- Tabela `conta_receber` + enum + RLS + migração → Task 1. ✓
- Domínio `validarTransicaoConta` (aberta→recebida/cancelada; cancelada→aberta; recebida terminal) + drift → Task 1. ✓
- `financeiro:gerir` no catálogo + PROIBIDAS_NO_CHAO + cargos-semente + migração de dados → Task 1. ✓
- `aprovarOrcamento` cria/atualiza a conta (aberta acompanha / recebida congela / cancelada reabre) → Task 2. ✓
- `cancelarConta` (só de aberta) + `contaDaOs` → Task 2. ✓
- Bloco Financeiro no detalhe da OS (exibe; cancelar; RBAC dinheiro:ver pra ver, financeiro:gerir pra cancelar) → Task 3. ✓
- Isolamento A↔B → Task 1 (conta) + Task 2 (aplicação). ✓
- Regressão (aprovarOrcamento ainda libera o gate) → Task 2 Step 6. ✓
- Deploy + verificar financeiro:gerir no cloud → Task 4. ✓
- Fora de escopo (P-4b baixa, P-4c relatório, fiscal, gateway) → nenhuma task os inclui. ✓

**2. Placeholders:** sem placeholder. O teste de isolamento (Task 1 Step 11) foi escrito COMPLETO — cria OS+orçamento via `abrirOS` para os FKs e faz as asserções reais (A só vê a própria conta + WITH CHECK barra cross-tenant). O `revalidatePath` da action (Task 3 Step 1) é resolvido: a action recebe `(contaId, osId)`. Os números de migration (00XX/00YY/00ZZ) são o índice real do drizzle (Task 1 Step 4), anotados na geração.

**3. Consistência de tipos:** `ContaView {id, status: StatusConta, valorCentavos}` definido na Task 2 e consumido na Task 3; `validarTransicaoConta(de, para)` idêntico entre domínio (Task 1) e uso (Task 2 cancelarConta); `STATUS_CONTA`/`StatusConta` uniformes; `financeiro:gerir` string exata em todos os lugares (catálogo, cargos-semente, migração SQL, gate da action). `calcularOrcamento(itens).total` (Task 2) é a API real verificada.

**4. Risco residual (para o revisor):** (a) adicionar `financeiro:gerir` ao catálogo QUEBRA o teste "catálogo tem 10 chaves" — a Task 1 Step 10 manda atualizar para 11; o reviewer confirma que foi feito e que nenhum outro teste do cargo ficou defasado. (b) a mudança no `aprovarOrcamento` é dentro de uma função do M5 já no ar — o reviewer confirma que o comportamento existente (status→aprovado + evento de canal + liberar o gate) permanece e só a conta foi adicionada, na mesma transação. (c) a migração de dados `financeiro:gerir` usa `array_append` idempotente — o reviewer confirma que só toca Dono/Gestor/Financeiro sistema e que a Recepção NÃO ganha a permissão.
