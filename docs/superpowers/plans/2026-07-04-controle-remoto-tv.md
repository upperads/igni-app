# Controle Remoto de TV por Setor (P-3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada TV vira um dispositivo de tela registrado (token, como o quiosque) que o escritório controla remotamente — troca o que a TV mostra em `/config/telas` e a TV obedece em <2s pelo realtime que já existe.

**Architecture:** Tabela `tela` por tenant (RLS), no molde do `quiosque_setor`. A config (`modo` estação|geral + `estacao_id`) é a linha. Rota pública `/tv/[token]` resolve a tela por token (etapa privilegiada mínima, como `resolverQuiosque`), renderiza o board read-only filtrado (reusa o visual do `/painel/tv`) e assina o realtime. `configurarTela` dispara `notificarPainel` → a TV relê. A `/painel/tv` logada continua existindo.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Drizzle ORM + Postgres (Supabase), RLS multi-tenant via `withTenant`, Supabase Realtime (Broadcast), Tailwind v4, Vitest, `qrcode` (já no projeto).

## Global Constraints

- **TypeScript strict, zero `any`.** Lint estrito (ESLint flat + boundary guard: `src/app` NUNCA importa `@/infra/db/client` nem `db`/`database`).
- **Isolamento multi-tenant sempre** (regra de ouro #7): toda tabela nova tem `tenant_id` + política RLS **na mesma migration**; todo acesso a dados é testado contra vazamento entre tenants (A↔B).
- **Migrations só via Drizzle** (`drizzle-kit generate` gera o SQL do schema; RLS é escrita à mão seguindo o padrão). Migration cloud roda via `railway run --service igni-app pnpm db:migrate` (a `DATABASE_URL` do cloud vive nos secrets do Railway; o `.env` local aponta para `127.0.0.1:5442x`).
- **SEM Playwright.** Verificação por typecheck/lint/build/test + checagens HTTP (curl).
- **CI verde antes do deploy.** Deploy: `railway up --service igni-app --ci`. Commit/push no GitHub junto (o `git push` mostra um stderr no PowerShell que é SUCESSO — usar Bash).
- **Commits Conventional** por módulo. Toda mensagem termina com:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Escopo mínimo da TV (segurança):** a rota pública `/tv/[token]` SÓ exibe o painel. Nunca avança OS, nunca vê dinheiro/orçamento/cliente/placa, nunca navega para outra rota.
- **Token de dispositivo (reuso, exato):** `hashToken(token)` = sha256 puro (token de 32 bytes, alta entropia — a TELA NÃO tem PIN). Token = `randomBytes(32).toString("base64url")`. Código curto via `gerarCodigoCurto(nome, sufixo)` com retry na colisão do UNIQUE.
- **Resolução por token = etapa PRIVILEGIADA mínima:** lookup por `token_hash` roda em `database.db` (fora de `withTenant`); `tenant_id`/`modo`/`estacao_id` vêm do REGISTRO, nunca do input; `null` se `revogado_em` preenchido ou inexistente.
- **Invariante da tela:** `modo=estacao` exige `estacao_id`; `modo=geral` exige `estacao_id` nulo; `nome` não vazio.
- **Enum `modo_tela`** (`estacao`, `geral`) espelhado no domínio com teste de drift (como os outros enums).

---

## Estrutura de arquivos

**Criados:**
- `src/infra/db/schema/tela.ts` — tabela `tela` (Drizzle).
- `src/infra/db/migrations/00XX_*.sql` — CREATE TABLE tela + enum modo_tela (gerado).
- `src/infra/db/migrations/00YY_rls_tela.sql` — RLS da tela (à mão).
- `src/domain/os/tela.ts` — `MODOS_TELA`, `type ModoTela`, `validarTela`.
- `src/domain/os/__tests__/tela.test.ts` — testes do domínio (invariante + drift).
- `src/application/tela.ts` — casos de uso (listar/registrar/configurar/revogar/resolver).
- `src/application/__tests__/tela.test.ts` — testes de aplicação (isolamento, invariante, revogada não resolve).
- `src/infra/composition/tela.ts` — wrappers `*NoTenant` + `dadosTela` (rota pública).
- `src/infra/db/__tests__/tela-isolation.test.ts` — isolamento RLS A↔B.
- `src/app/tv/[token]/page.tsx` — rota pública: board read-only da TV.
- `src/app/tv/[token]/tv-board.tsx` — componente do board (client, assina realtime) OU server + `<RealtimePainel>` (ver Task 3).
- `src/app/tv/entrar/page.tsx` + `src/app/tv/entrar/entrar-tela.tsx` — pareamento por código curto.
- `src/app/config/telas/page.tsx` — tela de gestão.
- `src/app/config/telas/painel-telas.tsx` — client component (registrar/trocar/revogar).
- `src/app/config/telas/actions.ts` — server actions (RBAC config:editar).

**Modificados:**
- `src/infra/db/schema/enums.ts` — adiciona `modoTela` pgEnum.
- `src/infra/db/schema/index.ts` — exporta `tela`.
- `src/infra/auth/supabase-middleware.ts` — adiciona `/tv` a `ROTAS_LIVRES`.
- `src/ui/components/app-shell.tsx` — adiciona "Telas" ao `NAV_CONFIG`.

---

## Task 1: Schema `tela` + enum `modo_tela` + RLS + domínio + isolamento

**Files:**
- Create: `src/infra/db/schema/tela.ts`
- Modify: `src/infra/db/schema/enums.ts`
- Modify: `src/infra/db/schema/index.ts`
- Create (gerado): `src/infra/db/migrations/00XX_*.sql`
- Create (à mão): `src/infra/db/migrations/00YY_rls_tela.sql`
- Create: `src/domain/os/tela.ts`
- Create: `src/domain/os/__tests__/tela.test.ts`
- Create: `src/infra/db/__tests__/tela-isolation.test.ts`

**Interfaces:**
- Produces: tabela `tela` (export `tela`); enum `modoTela`; `MODOS_TELA`, `type ModoTela`, `validarTela({nome, modo, estacaoId})` de `@/domain/os/tela`.

- [ ] **Step 1: Adicionar o enum `modo_tela`**

Em `src/infra/db/schema/enums.ts`, ver o padrão dos pgEnum existentes e adicionar:
```typescript
export const modoTela = pgEnum("modo_tela", ["estacao", "geral"]);
```
(Se o arquivo importa `pgEnum` de `drizzle-orm/pg-core`, reusar o import; senão adicioná-lo.)

- [ ] **Step 2: Escrever o schema da tabela `tela`**

`src/infra/db/schema/tela.ts`:
```typescript
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { modoTela } from "./enums";
import { estacao } from "./estacao";
import { tenant } from "./tenant";
import { usuario } from "./usuario";

/**
 * Tela (P-3): a "TV do setor" como DISPOSITIVO, no molde do quiosque. Credencial forte de dispositivo
 * (token de 32 bytes; só o `token_hash` mora aqui). O escritório controla remotamente o que ela mostra
 * (`modo` estacao|geral + `estacao_id`); a TV relê ao receber o ping do realtime. Read-only: a tela só
 * EXIBE o painel. Longo-viva (fica na parede); o controle é a REVOGAÇÃO manual (`revogado_em`).
 */
export const tela = pgTable("tela", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  modo: modoTela("modo").notNull(),
  estacaoId: uuid("estacao_id").references(() => estacao.id, { onDelete: "set null" }),
  tokenHash: text("token_hash").notNull().unique(),
  codigoCurto: text("codigo_curto").notNull().unique(),
  criadoPor: uuid("criado_por").references(() => usuario.id, { onDelete: "set null" }),
  revogadoEm: timestamp("revogado_em", { withTimezone: true }),
  ultimoUsoEm: timestamp("ultimo_uso_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 3: Exportar `tela` no barrel**

Em `src/infra/db/schema/index.ts`, adicionar junto das outras tabelas:
```typescript
export * from "./tela";
```

- [ ] **Step 4: Gerar a migration do schema**

Antes: confira o maior número em `src/infra/db/migrations/` (o P-1 foi até 0024). Run:
`pnpm drizzle-kit generate`
Expected: cria `src/infra/db/migrations/00XX_<nome>.sql` (00XX = próximo, provavelmente 0025) com `CREATE TYPE "public"."modo_tela" AS ENUM('estacao', 'geral')`, `CREATE TABLE "tela" (...)` e os FKs (`tela_tenant_id_tenant_id_fk`, `tela_estacao_id_estacao_id_fk`, `tela_criado_por_usuario_id_fk`). Anote o número 00XX e o próximo livre 00YY.

- [ ] **Step 5: Escrever a migration de RLS (à mão)**

Crie `src/infra/db/migrations/00YY_rls_tela.sql` (00YY = 00XX+1). Conteúdo:
```sql
-- RLS multi-tenant das telas (P-3). Mesmo padrão do 0023_rls_cargo:
-- GRANT ao app_user + ENABLE (SEM FORCE) + política de isolamento por tenant.
-- `app_user` já existe (migration 0001).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "tela" TO app_user;--> statement-breakpoint

ALTER TABLE "tela" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY tela_tenant_isolation ON "tela"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
```

- [ ] **Step 6: Registrar a migration manual no journal + aplicar**

Abra `src/infra/db/migrations/meta/_journal.json` e adicione a entrada da 00YY (idx incremental, `when` = o da 00XX +1, `tag` = nome do arquivo sem `.sql`, `breakpoints: true`) — replicando exatamente como 0023 (RLS manual anterior) está registrado.

Run: `pnpm db:migrate` (banco LOCAL do `.env`)
Expected: aplica 00XX e 00YY sem erro; "migrations applied successfully".

- [ ] **Step 7: Escrever os testes do domínio (RED)**

`src/domain/os/__tests__/tela.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { modoTela } from "@/infra/db/schema/enums";
import { MODOS_TELA, validarTela } from "@/domain/os/tela";
import { DadosInvalidosError } from "@/domain/shared/errors";

describe("tela — domínio", () => {
  it("o enum do banco espelha MODOS_TELA (drift)", () => {
    expect([...MODOS_TELA].sort()).toEqual([...modoTela.enumValues].sort());
  });

  it("modo=estacao EXIGE estacao_id", () => {
    expect(() => validarTela({ nome: "TV Bloco", modo: "estacao", estacaoId: null })).toThrow(DadosInvalidosError);
    expect(() => validarTela({ nome: "TV Bloco", modo: "estacao", estacaoId: "abc" })).not.toThrow();
  });

  it("modo=geral EXIGE estacao_id nulo", () => {
    expect(() => validarTela({ nome: "Corredor", modo: "geral", estacaoId: "abc" })).toThrow(DadosInvalidosError);
    expect(() => validarTela({ nome: "Corredor", modo: "geral", estacaoId: null })).not.toThrow();
  });

  it("rejeita nome vazio", () => {
    expect(() => validarTela({ nome: "   ", modo: "geral", estacaoId: null })).toThrow(DadosInvalidosError);
  });
});
```

- [ ] **Step 8: Rodar o teste do domínio (verificar que falha)**

Run: `pnpm test src/domain/os/__tests__/tela.test.ts`
Expected: FAIL (`@/domain/os/tela` não existe).

- [ ] **Step 9: Escrever o domínio**

`src/domain/os/tela.ts`:
```typescript
import { DadosInvalidosError } from "@/domain/shared/errors";

/** Modos de uma tela (P-3): mostra UMA estação, ou a visão geral (tudo). Espelha o enum `modo_tela`. */
export const MODOS_TELA = ["estacao", "geral"] as const;
export type ModoTela = (typeof MODOS_TELA)[number];

/**
 * Invariante da tela: `estacao` exige uma estação; `geral` não tem estação. Nome não vazio.
 * Lança DadosInvalidosError — mesmo contrato de validarCargo/validarServico.
 */
export function validarTela(input: { nome: string; modo: ModoTela; estacaoId: string | null }): void {
  if (!input.nome.trim()) {
    throw new DadosInvalidosError("Dê um nome à tela.");
  }
  if (input.modo === "estacao" && !input.estacaoId) {
    throw new DadosInvalidosError("Escolha a estação que esta tela mostra.");
  }
  if (input.modo === "geral" && input.estacaoId) {
    throw new DadosInvalidosError("A visão geral não aponta para uma estação.");
  }
}
```

- [ ] **Step 10: Rodar o teste do domínio (verde)**

Run: `pnpm test src/domain/os/__tests__/tela.test.ts`
Expected: 4/4 PASS.

- [ ] **Step 11: Escrever o teste de isolamento (RED)**

`src/infra/db/__tests__/tela-isolation.test.ts`:
```typescript
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/infra/db/connection";
import { tela, tenant } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

/** Isolamento RLS da tabela tela (regra de ouro #7): A nunca vê/toca as telas de B. */
describe("isolamento multi-tenant — tela (RLS)", () => {
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
    await database.db.delete(tela);
    await database.db.delete(tenant);
    const [a] = await database.db.insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db.insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    tenantA = a!.id;
    tenantB = b!.id;
  });

  it("A enxerga apenas as próprias telas", async () => {
    await database.db.insert(tela).values({ tenantId: tenantA, nome: "TV A", modo: "geral", tokenHash: "h-a", codigoCurto: "AAA1" });
    await database.db.insert(tela).values({ tenantId: tenantB, nome: "TV B", modo: "geral", tokenHash: "h-b", codigoCurto: "BBB1" });

    const vistos = await database.withTenant(tenantA, (tx) => tx.select().from(tela));
    expect(vistos).toHaveLength(1);
    expect(vistos[0]!.nome).toBe("TV A");

    const deB = await database.withTenant(tenantA, (tx) => tx.select().from(tela).where(eq(tela.nome, "TV B")));
    expect(deB).toHaveLength(0);
  });

  it("a RLS barra ESCREVER uma tela marcada como de outro tenant (WITH CHECK)", async () => {
    await expect(
      database.withTenant(tenantA, (tx) =>
        tx.insert(tela).values({ tenantId: tenantB, nome: "Intrusa", modo: "geral", tokenHash: "h-x", codigoCurto: "XXX1" }),
      ),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 12: Rodar o teste de isolamento (verde)**

Run: `pnpm test src/infra/db/__tests__/tela-isolation.test.ts`
Expected: 2/2 PASS. (Se o Docker de teste estiver fora, confiar no CI.)

- [ ] **Step 13: typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: verdes.

- [ ] **Step 14: Commit**

```bash
git add src/infra/db/schema/tela.ts src/infra/db/schema/enums.ts src/infra/db/schema/index.ts src/infra/db/migrations/ src/domain/os/tela.ts src/domain/os/__tests__/tela.test.ts src/infra/db/__tests__/tela-isolation.test.ts
git commit -m "feat(tela): schema + enum modo_tela + RLS + domínio validarTela (P-3 fatia 1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Aplicação + composição (CRUD + resolver por token privilegiado)

**Files:**
- Create: `src/application/tela.ts`
- Create: `src/application/__tests__/tela.test.ts`
- Create: `src/infra/composition/tela.ts`

**Interfaces:**
- Consumes: `validarTela`, `type ModoTela` de `@/domain/os/tela`; `hashToken` de `@/application/quiosque`; `gerarCodigoCurto` de `@/domain/os/quiosque`; `Database`; `tela`, `estacao` do schema; `SessaoTenant` de `@/application/abrir-os`; `notificarPainel` de `@/infra/realtime/notificar`.
- Produces:
  - `TelaView = { id; nome; modo; estacaoId; estacaoNome; codigoCurto; ativo; ultimoUsoEm }`.
  - `listarTelas(database, sessao): Promise<TelaView[]>`.
  - `registrarTela(database, sessao, input: {nome; modo; estacaoId}): Promise<{ token; codigoCurto }>`.
  - `configurarTela(database, sessao, id, input: {nome; modo; estacaoId}): Promise<void>`.
  - `revogarTela(database, sessao, id): Promise<void>`.
  - `TelaResolvida = { tenantId; telaId; modo; estacaoId }`.
  - `resolverTelaPorToken(database, tokenOuCodigo): Promise<TelaResolvida | null>` (privilegiada) + carimba `ultimo_uso_em`.

- [ ] **Step 1: Escrever os testes de aplicação (RED)**

`src/application/__tests__/tela.test.ts`:
```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { configurarTela, listarTelas, registrarTela, resolverTelaPorToken, revogarTela } from "@/application/tela";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { estacao, tela, tenant } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

vi.mock("@/infra/realtime/notificar", () => ({ notificarPainel: vi.fn().mockResolvedValue(undefined) }));

describe("aplicação — tela", () => {
  let database: Database;
  let tenantA: string;
  let tenantB: string;
  let estacaoA: string;
  const sessaoA = () => ({ tenantId: tenantA, usuarioId: "u-a" });
  const sessaoB = () => ({ tenantId: tenantB, usuarioId: "u-b" });

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
    await database.db.delete(tenant);
    const [a] = await database.db.insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db.insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    tenantA = a!.id;
    tenantB = b!.id;
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
```

- [ ] **Step 2: Rodar (RED)**

Run: `pnpm test src/application/__tests__/tela.test.ts`
Expected: FAIL (`@/application/tela` não existe).

- [ ] **Step 3: Escrever a aplicação**

`src/application/tela.ts`:
```typescript
import { randomBytes } from "node:crypto";
import { asc, eq, isNull } from "drizzle-orm";
import { gerarCodigoCurto, ALFABETO_CODIGO } from "@/domain/os/quiosque";
import { type ModoTela, validarTela } from "@/domain/os/tela";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { estacao, tela } from "@/infra/db/schema";
import { hashToken } from "@/application/quiosque";
import { notificarPainel } from "@/infra/realtime/notificar";
import type { SessaoTenant } from "./abrir-os";

/** Sufixo aleatório do código curto (4 chars do alfabeto sem ambíguos), via crypto. */
function sufixoCodigo(): string {
  const bytes = randomBytes(4);
  return Array.from(bytes, (b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join("");
}

export interface TelaView {
  id: string;
  nome: string;
  modo: ModoTela;
  estacaoId: string | null;
  estacaoNome: string | null;
  codigoCurto: string;
  ativo: boolean;
  ultimoUsoEm: Date | null;
}

export interface TelaInput {
  nome: string;
  modo: ModoTela;
  estacaoId: string | null;
}

/** Lista as telas do tenant (com nome da estação e se está ativa) — pra tela de gestão. */
export function listarTelas(database: Database, sessao: SessaoTenant): Promise<TelaView[]> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const linhas = await tx
      .select({
        id: tela.id, nome: tela.nome, modo: tela.modo, estacaoId: tela.estacaoId,
        estacaoNome: estacao.nome, codigoCurto: tela.codigoCurto,
        revogadoEm: tela.revogadoEm, ultimoUsoEm: tela.ultimoUsoEm,
      })
      .from(tela)
      .leftJoin(estacao, eq(estacao.id, tela.estacaoId))
      .orderBy(asc(tela.nome));
    return linhas.map((l) => ({
      id: l.id, nome: l.nome, modo: l.modo, estacaoId: l.estacaoId, estacaoNome: l.estacaoNome,
      codigoCurto: l.codigoCurto, ativo: l.revogadoEm === null, ultimoUsoEm: l.ultimoUsoEm,
    }));
  });
}

/**
 * Registra uma tela (dispositivo): cria o token forte (devolve o CRU uma vez p/ o QR), guarda só o
 * hash + código curto único. Valida ANTES do withTenant (throw → rejeição de Promise). Escopado (RLS).
 */
export async function registrarTela(
  database: Database,
  sessao: SessaoTenant,
  input: TelaInput,
): Promise<{ token: string; codigoCurto: string }> {
  validarTela(input);
  return database.withTenant(sessao.tenantId, async (tx) => {
    const token = randomBytes(32).toString("base64url");
    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      const codigoCurto = gerarCodigoCurto(input.nome, sufixoCodigo());
      try {
        await tx.insert(tela).values({
          tenantId: sessao.tenantId,
          nome: input.nome.trim(),
          modo: input.modo,
          estacaoId: input.estacaoId,
          tokenHash: hashToken(token),
          codigoCurto,
          criadoPor: sessao.usuarioId,
        });
        return { token, codigoCurto };
      } catch (err) {
        if (tentativa === 4) throw err;
      }
    }
    throw new DadosInvalidosError("Não foi possível registrar a tela. Tente de novo.");
  });
}

/** Troca o que a tela mostra (o coração do P-3) + dispara o ping para a TV reler. */
export async function configurarTela(
  database: Database,
  sessao: SessaoTenant,
  id: string,
  input: TelaInput,
): Promise<void> {
  validarTela(input);
  await database.withTenant(sessao.tenantId, async (tx) => {
    await tx
      .update(tela)
      .set({ nome: input.nome.trim(), modo: input.modo, estacaoId: input.estacaoId })
      .where(eq(tela.id, id));
  });
  await notificarPainel(sessao.tenantId);
}

/** Revoga (desliga) uma tela: mata o token na hora. RLS garante que só o próprio tenant revoga. */
export function revogarTela(database: Database, sessao: SessaoTenant, id: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx.update(tela).set({ revogadoEm: new Date() }).where(eq(tela.id, id));
  });
}

export interface TelaResolvida {
  tenantId: string;
  telaId: string;
  modo: ModoTela;
  estacaoId: string | null;
}

/**
 * Etapa PRIVILEGIADA mínima (espelha resolverQuiosque): resolve a tela por TOKEN (`token_hash`) OU
 * código curto. O tenant/modo/estação vêm do REGISTRO, nunca do input. Null se revogada/inexistente.
 * Carimba `ultimo_uso_em` (best-effort). Usa `database.db` (fora do withTenant — o lookup atravessa
 * tenants por token; a leitura do painel depois abre withTenant no tenant resolvido).
 */
export async function resolverTelaPorToken(
  database: Database,
  tokenOuCodigo: string,
): Promise<TelaResolvida | null> {
  if (!tokenOuCodigo || tokenOuCodigo.length < 4) {
    return null;
  }
  const [porToken] = await database.db
    .select({ id: tela.id, tenantId: tela.tenantId, modo: tela.modo, estacaoId: tela.estacaoId, revogadoEm: tela.revogadoEm })
    .from(tela)
    .where(eq(tela.tokenHash, hashToken(tokenOuCodigo)))
    .limit(1);
  const linha =
    porToken ??
    (
      await database.db
        .select({ id: tela.id, tenantId: tela.tenantId, modo: tela.modo, estacaoId: tela.estacaoId, revogadoEm: tela.revogadoEm })
        .from(tela)
        .where(eq(tela.codigoCurto, tokenOuCodigo))
        .limit(1)
    )[0];

  if (!linha || linha.revogadoEm !== null) {
    return null;
  }
  await database.db.update(tela).set({ ultimoUsoEm: new Date() }).where(eq(tela.id, linha.id));
  return { tenantId: linha.tenantId, telaId: linha.id, modo: linha.modo, estacaoId: linha.estacaoId };
}
```

> Nota: confirme como `hashToken` é exportado por `@/application/quiosque` (o brief verificou que sim). Se `ALFABETO_CODIGO`/`gerarCodigoCurto` não estiverem exportados de `@/domain/os/quiosque`, confira o arquivo real e ajuste o import; a Task 1 do quiosque os usa, então existem.

- [ ] **Step 4: Rodar (verde)**

Run: `pnpm test src/application/__tests__/tela.test.ts`
Expected: 5/5 PASS.

- [ ] **Step 5: Escrever a composição**

`src/infra/composition/tela.ts`:
```typescript
import type { SessaoTenant } from "@/application/abrir-os";
import {
  configurarTela,
  listarTelas,
  registrarTela,
  resolverTelaPorToken,
  revogarTela,
  type TelaInput,
  type TelaResolvida,
  type TelaView,
} from "@/application/tela";
import { listarPainel } from "@/infra/composition/os";
import { database } from "@/infra/db/client";

/** Composição das telas (P-3): liga os casos de uso ao tenant. A web importa daqui. */
export type { TelaView, TelaInput };

export function listarTelasNoTenant(sessao: SessaoTenant): Promise<TelaView[]> {
  return listarTelas(database, sessao);
}
export function registrarTelaNoTenant(sessao: SessaoTenant, input: TelaInput): Promise<{ token: string; codigoCurto: string }> {
  return registrarTela(database, sessao, input);
}
export function configurarTelaNoTenant(sessao: SessaoTenant, id: string, input: TelaInput): Promise<void> {
  return configurarTela(database, sessao, id, input);
}
export function revogarTelaNoTenant(sessao: SessaoTenant, id: string): Promise<void> {
  return revogarTela(database, sessao, id);
}

export interface DadosTv {
  tenantId: string;
  modo: TelaResolvida["modo"];
  estacaoId: string | null;
  /** Grupos já filtrados p/ renderizar: em modo=estacao, só a estação; em geral, todas as etapas. */
  etapas: Awaited<ReturnType<typeof listarPainel>>["etapas"];
  kpis: Awaited<ReturnType<typeof listarPainel>>["kpis"];
}

/**
 * Dados da rota pública /tv/[token]: resolve a tela (privilegiado), depois lê o painel no tenant DA
 * TELA (withTenant via {tenantId}). Null se token inválido/revogado → a rota mostra "desconectada".
 */
export async function dadosTv(tokenOuCodigo: string): Promise<DadosTv | null> {
  const resolvida = await resolverTelaPorToken(database, tokenOuCodigo);
  if (!resolvida) {
    return null;
  }
  const ctx: SessaoTenant = { tenantId: resolvida.tenantId, usuarioId: "" };
  const { kpis, etapas } = await listarPainel(ctx);
  if (resolvida.modo === "estacao" && resolvida.estacaoId) {
    // Só as OS da estação da tela: filtra os cards pelo estacaoId.
    const etapasFiltradas = etapas
      .map((e) => ({ ...e, cards: e.cards.filter((c) => c.estacaoId === resolvida.estacaoId) }))
      .filter((e) => e.cards.length > 0);
    return { tenantId: resolvida.tenantId, modo: resolvida.modo, estacaoId: resolvida.estacaoId, etapas: etapasFiltradas, kpis };
  }
  return { tenantId: resolvida.tenantId, modo: resolvida.modo, estacaoId: null, etapas, kpis };
}
```

> Nota sobre a leitura sem sessão de usuário: `listarPainel(ctx)` recebe `SessaoTenant` e usa só `ctx.tenantId` internamente (verificado). Passar `{ tenantId, usuarioId: "" }` é seguro — nenhuma escrita usa `usuarioId` nesse caminho. Se o typecheck reclamar do `usuarioId: ""`, é aceitável (é string); não relaxar o tipo.

- [ ] **Step 6: typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: verdes. Boundary guard OK (composição importa o client; aplicação não).

- [ ] **Step 7: Commit**

```bash
git add src/application/tela.ts src/application/__tests__/tela.test.ts src/infra/composition/tela.ts
git commit -m "feat(tela): aplicação — CRUD + resolver por token privilegiado + dadosTv (P-3 fatia 2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Rota pública `/tv/[token]` + pareamento `/tv/entrar` + ROTAS_LIVRES

**Files:**
- Create: `src/app/tv/[token]/page.tsx`
- Create: `src/app/tv/[token]/tv-board.tsx`
- Create: `src/app/tv/entrar/page.tsx`
- Create: `src/app/tv/entrar/entrar-tela.tsx`
- Modify: `src/infra/auth/supabase-middleware.ts`

**Interfaces:**
- Consumes: `dadosTv` de `@/infra/composition/tela`; `resolverTelaPorToken` (via composição) para o pareamento; `RealtimePainel` de `@/app/_components/realtime-painel`; `RiskRail`, `OsCard`, `Relogio` de `@/ui/components/*`.
- Produces: rotas `/tv/[token]` e `/tv/entrar`.

- [ ] **Step 1: Adicionar `/tv` a `ROTAS_LIVRES`**

Em `src/infra/auth/supabase-middleware.ts`, o array `ROTAS_LIVRES` (linha ~10) lista as rotas públicas sem auth. Adicionar `"/tv"`:
```typescript
const ROTAS_LIVRES = ["/recuperar", "/atualizar-senha", "/auth", "/portal", "/quiosque", "/tv"];
```

- [ ] **Step 2: Escrever o board da TV (client component que assina o realtime)**

`src/app/tv/[token]/tv-board.tsx` — recebe os dados já resolvidos e o tenantId; assina o realtime (reusa `RealtimePainel`) e renderiza read-only reusando o visual do `/painel/tv`:
```typescript
"use client";

import { RealtimePainel } from "@/app/_components/realtime-painel";
import type { DadosTv } from "@/infra/composition/tela";
import { OsCard } from "@/ui/components/os-card";
import { Relogio } from "@/ui/components/relogio";
import { RiskRail } from "@/ui/components/risk-rail";

export function TvBoard({ dados, titulo }: { dados: DadosTv; titulo: string }) {
  const { kpis, etapas, tenantId } = dados;
  const alarme = kpis.paradaCritica > 0 || kpis.atraso.total > 0;

  return (
    <div className="flex min-h-dvh flex-col bg-grafite-900">
      <RiskRail alarme={alarme} />
      <header className="flex items-center justify-between gap-4 border-b border-grafite-700 px-6 py-4">
        <div className="flex items-baseline gap-4">
          <span className="font-display text-2xl font-bold tracking-tight text-ambar-500">IGNI</span>
          <span className="font-mono text-sm uppercase tracking-widest text-aco-300">{titulo}</span>
        </div>
        <div className="flex items-center gap-5">
          <RealtimePainel tenantId={tenantId} />
          <Relogio className="font-mono text-2xl tabular-nums text-aco-100" />
        </div>
      </header>
      <main className="flex-1 px-6 py-6">
        {etapas.length === 0 ? (
          <div className="grid h-full place-items-center">
            <p className="font-display text-2xl text-aco-300">Nenhum serviço aqui agora.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {etapas.map((etapa) => (
              <section key={etapa.estado} aria-label={`Etapa ${etapa.rotulo}`}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="font-display text-2xl text-aco-100">{etapa.rotulo}</h2>
                  <span className="font-mono text-sm text-aco-400">{etapa.cards.length}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {etapa.cards.map((card) => (
                    <OsCard
                      key={card.id}
                      codigo={card.codigo}
                      equipamento={card.equipamento}
                      responsavel={card.responsavel}
                      prazo={card.prazoLabel}
                      sinal={card.sinal}
                      travado={card.travado}
                      responsabilidade={card.travamentoResponsabilidade}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```
> Confirme os nomes das props de `OsCard` contra `src/app/painel/tv/page.tsx` (o board logado usa exatamente `codigo/equipamento/responsavel/prazo/sinal/travado/responsabilidade`). Reusar idênticos.

- [ ] **Step 3: Escrever a página pública `/tv/[token]`**

`src/app/tv/[token]/page.tsx` — resolve os dados; rate-limit por IP (espelha o quiosque); "desconectada" para token inválido/revogado. O título é "Visão geral" ou o nome da estação:
```typescript
import { headers } from "next/headers";
import type { Metadata } from "next";
import { dadosTv } from "@/infra/composition/tela";
import { dentroDoLimite } from "@/infra/rate-limit";
import { TvBoard } from "./tv-board";

export const metadata: Metadata = {
  title: "Painel — Igni (TV)",
};

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-grafite-900 px-5 py-10">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <span className="font-display text-2xl font-bold tracking-tight text-ambar-500">IGNI</span>
        {children}
      </div>
    </main>
  );
}

/** TV do setor (público, sem sessão — o token é a credencial). Read-only, controlada pelo escritório. */
export default async function TvPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const muitas =
    !dentroDoLimite(`tv-view-ip:${ip}`, { limite: 40, janelaMs: 60_000 }) ||
    !dentroDoLimite(`tv-view:${token}`, { limite: 120, janelaMs: 60_000 });
  if (muitas) {
    return (
      <Moldura>
        <h1 className="font-display text-2xl text-aco-100">Muitas tentativas</h1>
        <p className="font-body text-aco-300">Aguarde um instante e atualize a página.</p>
      </Moldura>
    );
  }

  const dados = await dadosTv(token);
  if (!dados) {
    return (
      <Moldura>
        <h1 className="font-display text-2xl text-aco-100">Tela desconectada</h1>
        <p className="font-body text-aco-300">Esta tela foi desligada. Fale com o escritório.</p>
      </Moldura>
    );
  }

  const titulo = dados.modo === "geral" ? "Visão geral" : (dados.etapas[0]?.cards[0]?.estacaoNome ?? "Setor");
  return <TvBoard dados={dados} titulo={titulo} />;
}
```
> O `titulo` para `modo=estacao`: como o board filtra por `estacaoId`, o nome da estação não está garantido nos cards se não houver OS. Melhoria opcional: `dadosTv` retornar o nome da estação resolvida. Para esta fatia, derivar do primeiro card OU passar `estacaoNome` no `DadosTv` (preferir: adicionar `estacaoNome: string | null` ao `DadosTv` na Task 2 — se fizer, atualize o consumo aqui). Decisão do implementer: se simples, incluir `estacaoNome` no `DadosTv`; senão, o fallback "Setor" é aceitável.

- [ ] **Step 4: Escrever o pareamento `/tv/entrar`**

**Sem `actions.ts`** — o pareamento é 100% client-side. A rota `/tv/[token]` já resolve por token OU código curto (o `resolverTelaPorToken` da Task 2 tenta os dois), e só temos o hash do token no banco (não dá para recuperar o token cru a partir do código). Então o form apenas redireciona o navegador para `/tv/{codigo}` — a própria rota valida e mostra "desconectada" se o código não existir. Crie só os dois arquivos abaixo.

`src/app/tv/entrar/entrar-tela.tsx`:
```typescript
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Pareamento da TV: digita o código curto e vai para /tv/{codigo} (a rota aceita token OU código). */
export function EntrarTela() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const c = codigo.trim();
        if (c.length >= 4) router.push(`/tv/${encodeURIComponent(c)}`);
      }}
      className="flex w-full max-w-xs flex-col gap-3"
    >
      <input
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.toUpperCase())}
        aria-label="Código da tela"
        placeholder="Código da tela"
        className="rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 text-center font-mono text-lg tracking-widest text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
      />
      <button type="submit" className="rounded-md bg-ambar-500 px-4 py-2 font-body text-sm font-medium text-grafite-950 hover:bg-ambar-400">
        Conectar esta tela
      </button>
    </form>
  );
}
```
`src/app/tv/entrar/page.tsx`:
```typescript
import type { Metadata } from "next";
import { EntrarTela } from "./entrar-tela";

export const metadata: Metadata = { title: "Conectar tela — Igni" };

export default function EntrarTelaPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-grafite-900 px-5 py-10">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="font-display text-2xl font-bold tracking-tight text-ambar-500">IGNI</span>
        <h1 className="font-display text-2xl text-aco-100">Conectar esta TV</h1>
        <p className="font-body text-sm text-aco-300">Digite o código que aparece no escritório (Configurações → Telas).</p>
        <EntrarTela />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: verdes. As rotas `/tv/[token]` e `/tv/entrar` aparecem no build.

- [ ] **Step 6: Commit**

```bash
git add src/app/tv/ src/infra/auth/supabase-middleware.ts
git commit -m "feat(tela): rota pública /tv/[token] read-only + pareamento /tv/entrar (P-3 fatia 3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Tela de gestão `/config/telas` + nav

**Files:**
- Create: `src/app/config/telas/page.tsx`
- Create: `src/app/config/telas/painel-telas.tsx`
- Create: `src/app/config/telas/actions.ts`
- Modify: `src/ui/components/app-shell.tsx`

**Interfaces:**
- Consumes: `listarTelasNoTenant`, `registrarTelaNoTenant`, `configurarTelaNoTenant`, `revogarTelaNoTenant`, `type TelaView` de `@/infra/composition/tela`; `listarEstacoesNoTenant` de `@/infra/composition/config` (para o seletor de estação); `pode`/`type Permissao` de `@/domain/auth/cargo`; `sessaoAtual`.
- Produces: rota `/config/telas`; item de nav "Telas".

- [ ] **Step 1: Escrever as server actions com RBAC no boundary**

`src/app/config/telas/actions.ts` (espelha `estacoes/actions.ts`: gate `config:editar`, QR na criação via `qrcode`):
```typescript
"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { type Permissao, pode } from "@/domain/auth/cargo";
import { type ModoTela } from "@/domain/os/tela";
import { DadosInvalidosError } from "@/domain/shared/errors";
import { type SessaoUsuario, sessaoAtual } from "@/infra/auth/sessao";
import {
  configurarTelaNoTenant,
  registrarTelaNoTenant,
  revogarTelaNoTenant,
} from "@/infra/composition/tela";

async function autorizar(acao: Permissao): Promise<{ sessao: SessaoUsuario } | { erro: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { erro: "Sua sessão expirou. Entre novamente." };
  }
  if (!pode(sessao.permissoes, acao)) {
    return { erro: "Você não tem permissão para configurar as telas." };
  }
  return { sessao };
}

export interface ResultadoAcao {
  ok: boolean;
  motivo?: string;
}

export interface ResultadoRegistrar extends ResultadoAcao {
  qrDataUrl?: string;
  codigoCurto?: string;
  url?: string;
}

function lerModo(modo: string, estacaoId: string | null): { modo: ModoTela; estacaoId: string | null } | { erro: string } {
  if (modo !== "estacao" && modo !== "geral") {
    return { erro: "Modo inválido." };
  }
  return { modo, estacaoId: modo === "estacao" ? estacaoId : null };
}

export async function acaoRegistrarTela(nome: string, modo: string, estacaoId: string | null): Promise<ResultadoRegistrar> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  const m = lerModo(modo, estacaoId);
  if ("erro" in m) return { ok: false, motivo: m.erro };
  try {
    const { token, codigoCurto } = await registrarTelaNoTenant(auth.sessao, { nome, modo: m.modo, estacaoId: m.estacaoId });
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://igni-app-production.up.railway.app";
    const url = `${base}/tv/${token}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1 });
    revalidatePath("/config/telas");
    return { ok: true, qrDataUrl, codigoCurto, url };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível registrar a tela." };
  }
}

export async function acaoConfigurarTela(id: string, nome: string, modo: string, estacaoId: string | null): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  const m = lerModo(modo, estacaoId);
  if ("erro" in m) return { ok: false, motivo: m.erro };
  try {
    await configurarTelaNoTenant(auth.sessao, id, { nome, modo: m.modo, estacaoId: m.estacaoId });
    revalidatePath("/config/telas");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível salvar a tela." };
  }
}

export async function acaoRevogarTela(id: string): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await revogarTelaNoTenant(auth.sessao, id);
    revalidatePath("/config/telas");
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível revogar." };
  }
}
```

- [ ] **Step 2: Escrever a página (server component)**

`src/app/config/telas/page.tsx`:
```typescript
import { redirect } from "next/navigation";
import { pode } from "@/domain/auth/cargo";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarEstacoesNoTenant } from "@/infra/composition/config";
import { listarTelasNoTenant } from "@/infra/composition/tela";
import { AppShell } from "@/ui/components/app-shell";
import { PainelTelas } from "./painel-telas";

export default async function TelasPage() {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }
  if (!pode(sessao.permissoes, "config:editar")) {
    redirect("/");
  }
  const [telas, estacoes] = await Promise.all([
    listarTelasNoTenant(sessao),
    listarEstacoesNoTenant(sessao),
  ]);
  return (
    <AppShell>
      <header className="mb-5">
        <h1 className="font-display text-3xl font-bold tracking-tight text-aco-100">Telas</h1>
        <p className="mt-1 max-w-prose font-body text-sm text-aco-400">
          Cadastre as TVs dos setores e controle daqui o que cada uma mostra. A TV obedece na hora —
          sem ninguém ir até ela.
        </p>
      </header>
      <PainelTelas telas={telas} estacoes={estacoes.map((e) => ({ id: e.id, nome: e.nome }))} />
    </AppShell>
  );
}
```
> Confirme a assinatura de `listarEstacoesNoTenant` em `@/infra/composition/config` (o retorno tem `id` e `nome`). Se o nome do wrapper diferir, ajuste (o `os/[id]/page.tsx` já o usa — copie de lá).

- [ ] **Step 3: Escrever o painel (client component)**

`src/app/config/telas/painel-telas.tsx` — lista as telas; form de registrar (nome + modo + estação) que mostra QR/código na resposta; editar o que mostra; revogar. Segue o padrão de `painel-equipe.tsx`/`editor-servicos` (useTransition, mostra erro):
```typescript
"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import type { TelaView } from "@/infra/composition/tela";
import { acaoConfigurarTela, acaoRegistrarTela, acaoRevogarTela } from "./actions";

type Estacao = { id: string; nome: string };

export function PainelTelas({ telas, estacoes }: { telas: TelaView[]; estacoes: Estacao[] }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [novoQr, setNovoQr] = useState<{ qrDataUrl: string; codigoCurto: string; url: string } | null>(null);

  function rodar(acao: () => Promise<{ ok: boolean; motivo?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) setErro(r.motivo ?? "Não deu certo.");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {novoQr ? (
        <section className="rounded-lg border border-ambar-600/40 bg-grafite-850 p-4">
          <h2 className="font-display text-lg text-aco-100">Tela registrada — conecte a TV</h2>
          <p className="mt-1 font-body text-sm text-aco-400">
            Abra <span className="font-mono text-aco-200">/tv/entrar</span> na TV e digite o código, ou aponte a câmera para o QR.
            Este código aparece só agora.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-5">
            <Image src={novoQr.qrDataUrl} alt="QR da tela" width={160} height={160} className="rounded bg-white p-1" unoptimized />
            <div className="font-mono">
              <p className="text-2xl tracking-widest text-ambar-500">{novoQr.codigoCurto}</p>
              <p className="mt-1 break-all text-xs text-aco-400">{novoQr.url}</p>
            </div>
          </div>
          <button type="button" onClick={() => setNovoQr(null)} className="mt-4 font-body text-sm text-aco-400 hover:text-aco-100">Fechar</button>
        </section>
      ) : null}

      <NovaTela
        estacoes={estacoes}
        pendente={pendente}
        onRegistrar={(nome, modo, estacaoId) =>
          iniciar(async () => {
            setErro(null);
            const r = await acaoRegistrarTela(nome, modo, estacaoId);
            if (!r.ok) { setErro(r.motivo ?? "Não foi possível registrar."); return; }
            if (r.qrDataUrl && r.codigoCurto && r.url) setNovoQr({ qrDataUrl: r.qrDataUrl, codigoCurto: r.codigoCurto, url: r.url });
          })
        }
      />

      <ul className="flex flex-col gap-2">
        {telas.map((t) => (
          <LinhaTela
            key={t.id}
            tela={t}
            estacoes={estacoes}
            pendente={pendente}
            onConfigurar={(nome, modo, estacaoId) => rodar(() => acaoConfigurarTela(t.id, nome, modo, estacaoId))}
            onRevogar={() => rodar(() => acaoRevogarTela(t.id))}
          />
        ))}
      </ul>

      {erro ? <p role="alert" className="font-body text-sm text-sinal-vermelho">{erro}</p> : null}
    </div>
  );
}

function SeletorModo({ modo, estacaoId, estacoes, onModo, onEstacao }: {
  modo: string; estacaoId: string | null; estacoes: Estacao[];
  onModo: (m: string) => void; onEstacao: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={modo} onChange={(e) => onModo(e.target.value)} aria-label="O que a tela mostra"
        className="rounded-md border border-grafite-600 bg-grafite-900 px-2 py-1.5 font-body text-sm text-aco-100">
        <option value="estacao">Uma estação</option>
        <option value="geral">Visão geral (tudo)</option>
      </select>
      {modo === "estacao" ? (
        <select value={estacaoId ?? ""} onChange={(e) => onEstacao(e.target.value || null)} aria-label="Qual estação"
          className="rounded-md border border-grafite-600 bg-grafite-900 px-2 py-1.5 font-body text-sm text-aco-100">
          <option value="">Escolha a estação…</option>
          {estacoes.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      ) : null}
    </div>
  );
}

function NovaTela({ estacoes, pendente, onRegistrar }: {
  estacoes: Estacao[]; pendente: boolean;
  onRegistrar: (nome: string, modo: string, estacaoId: string | null) => void;
}) {
  const [nome, setNome] = useState("");
  const [modo, setModo] = useState("estacao");
  const [estacaoId, setEstacaoId] = useState<string | null>(null);

  return (
    <section className="rounded-lg border border-grafite-700 bg-grafite-850 p-4">
      <h2 className="font-display text-lg text-aco-100">Nova tela</h2>
      <div className="mt-3 flex flex-col gap-3">
        <input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome da tela" placeholder="Ex.: TV do Bloco"
          className="rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none" />
        <SeletorModo modo={modo} estacaoId={estacaoId} estacoes={estacoes} onModo={setModo} onEstacao={setEstacaoId} />
        <div>
          <button type="button" disabled={pendente || !nome.trim() || (modo === "estacao" && !estacaoId)}
            onClick={() => { onRegistrar(nome, modo, estacaoId); setNome(""); setModo("estacao"); setEstacaoId(null); }}
            className="rounded-md bg-ambar-500 px-4 py-2 font-body text-sm font-medium text-grafite-950 hover:bg-ambar-400 disabled:opacity-50">
            Registrar tela
          </button>
        </div>
      </div>
    </section>
  );
}

function LinhaTela({ tela, estacoes, pendente, onConfigurar, onRevogar }: {
  tela: TelaView; estacoes: Estacao[]; pendente: boolean;
  onConfigurar: (nome: string, modo: string, estacaoId: string | null) => void;
  onRevogar: () => void;
}) {
  const [nome, setNome] = useState(tela.nome);
  const [modo, setModo] = useState<string>(tela.modo);
  const [estacaoId, setEstacaoId] = useState<string | null>(tela.estacaoId);
  const mostraAgora = tela.modo === "geral" ? "Visão geral" : (tela.estacaoNome ?? "—");

  return (
    <li className="rounded-lg border border-grafite-700 bg-grafite-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-body text-sm text-aco-100">{tela.nome}</p>
          <p className="font-mono text-xs text-aco-400">
            mostra: {mostraAgora} · código {tela.codigoCurto} · {tela.ativo ? "ativa" : "revogada"}
          </p>
        </div>
        {tela.ativo ? (
          <button type="button" onClick={onRevogar} disabled={pendente} className="font-body text-sm text-aco-400 hover:text-sinal-vermelho">Revogar</button>
        ) : null}
      </div>
      {tela.ativo ? (
        <div className="mt-3 flex flex-col gap-3">
          <input value={nome} onChange={(e) => setNome(e.target.value)} aria-label={`Nome da tela ${tela.nome}`}
            className="rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100" />
          <SeletorModo modo={modo} estacaoId={estacaoId} estacoes={estacoes} onModo={setModo} onEstacao={setEstacaoId} />
          <div>
            <button type="button" disabled={pendente || !nome.trim() || (modo === "estacao" && !estacaoId)}
              onClick={() => onConfigurar(nome, modo, estacaoId)}
              className="rounded-md bg-ambar-500 px-3 py-1.5 font-body text-sm font-medium text-grafite-950 hover:bg-ambar-400 disabled:opacity-50">
              Salvar o que mostra
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
```

- [ ] **Step 4: Adicionar "Telas" à nav de config**

Em `src/ui/components/app-shell.tsx`, no array `NAV_CONFIG`, adicionar após "Estações":
```typescript
const NAV_CONFIG = [
  { href: "/config/equipe", rotulo: "Equipe" },
  { href: "/config/estacoes", rotulo: "Estações" },
  { href: "/config/cargos", rotulo: "Cargos" },
  { href: "/config/telas", rotulo: "Telas" },
];
```
> Confirme a ordem real do array (o P-1 adicionou "Cargos"). Adicionar "Telas" ao fim.

- [ ] **Step 5: typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: verdes. A rota `/config/telas` aparece no build.

- [ ] **Step 6: Commit**

```bash
git add src/app/config/telas/ src/ui/components/app-shell.tsx
git commit -m "feat(tela): tela /config/telas (registrar QR + trocar o que mostra + revogar) + nav (P-3 fatia 4)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Pipeline + deploy (CI verde → migration cloud → railway up → smoke)

**Files:** nenhum código novo; conduz o merge e o deploy. (Executada pelo controlador, não por subagente.)

- [ ] **Step 1: Pipeline local completo**

Run: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`
Expected: tudo verde. (Docker de teste fora → confiar no CI para os testes de DB.)

- [ ] **Step 2: Merge + push**

```bash
git checkout main
git merge --no-ff feat/controle-remoto-tv -m "feat(tela): controle remoto de TV por setor (P-3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 3: Aguardar CI verde**

Run: `gh run watch $(gh run list --branch main --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`
Expected: exit 0 (build/lint/typecheck/testes incl. isolamento de tela + migrations).

- [ ] **Step 4: Migration no cloud**

Run: `railway run --service igni-app pnpm db:migrate`
Expected: aplica 00XX (tela + enum) e 00YY (RLS) sem erro.

- [ ] **Step 5: Verificar tela + RLS no cloud**

Escrever um script temporário na raiz (`verify-tela.mjs`, removido depois) que via `postgres` + `DATABASE_URL` do Railway confere: (a) tabela `tela` existe com as colunas; (b) `relrowsecurity=true`, `force=false`; (c) policy `tela_tenant_isolation`; (d) grants de `app_user`; (e) o enum `modo_tela` tem `estacao`/`geral`. Rodar com `railway run --service igni-app node verify-tela.mjs`. Remover após verificar. (Padrão idêntico ao deploy do P-1/P-2.)

- [ ] **Step 6: Deploy**

Run: `railway up --service igni-app --ci`
Expected: "Deploy complete".

- [ ] **Step 7: Smoke test (curl, sem Playwright)**

```bash
BASE="https://igni-app-production.up.railway.app"
curl -s -o /dev/null -w "login %{http_code}\n" "$BASE/login"                    # 200
curl -s -o /dev/null -w "config/telas %{http_code} -> %{redirect_url}\n" "$BASE/config/telas"  # 307 -> /login
curl -s -o /dev/null -w "tv invalido %{http_code}\n" "$BASE/tv/token-invalido"  # 200 (mostra "Tela desconectada", rota pública)
curl -s -o /dev/null -w "tv/entrar %{http_code}\n" "$BASE/tv/entrar"            # 200 (pareamento público)
```
Expected: `/login` 200; `/config/telas` 307 → /login; `/tv/token-invalido` 200 (página pública "desconectada"); `/tv/entrar` 200.

- [ ] **Step 8: Atualizar docs + apagar branch + memória**

- `docs/00_status.md`: registrar P-3 no ar.
- `docs/15_backlog_produto.md`: marcar P-3 como ✅ NO AR; próximo P-4 (financeiro).
- `git branch -d feat/controle-remoto-tv`.
- Memória: `controle-remoto-tv-p3.md` (tabela `tela`, token de dispositivo, `resolverTelaPorToken` privilegiado, config empurrada via `notificarPainel`, escopo mínimo read-only) + ponteiro no `MEMORY.md`.

---

## Self-review (feito pelo autor do plano)

**1. Cobertura do spec:**
- Tabela `tela` + enum + RLS + `usuario`/`estacao` FKs → Task 1. ✓
- Domínio `validarTela` (invariante modo↔estacao_id, nome vazio) + drift → Task 1. ✓
- Token de dispositivo (sha256, sem PIN) + código curto → Task 2 (`registrarTela`). ✓
- `resolverTelaPorToken` privilegiado (lookup fora do withTenant, tenant do registro, revogada→null) + carimba ultimo_uso → Task 2. ✓
- `configurarTela` dispara `notificarPainel` (o push) → Task 2. ✓
- Rota pública `/tv/[token]` read-only filtrada por modo + "desconectada" + assina realtime → Task 3. ✓
- Pareamento por código curto → Task 3 (`/tv/entrar` → `/tv/{codigo}`, e `resolverTelaPorToken` aceita código). ✓
- `/tv` em ROTAS_LIVRES → Task 3. ✓
- Tela `/config/telas` (registrar com QR/código, trocar o que mostra, revogar) + RBAC config:editar + nav → Task 4. ✓
- Isolamento A↔B → Tasks 1 e 2. ✓
- `/painel/tv` logada mantida → nenhuma task a remove. ✓
- Pipeline + deploy + smoke → Task 5. ✓

**2. Placeholders:** sem TBD/TODO de implementação. Os números de migration (00XX/00YY) são o índice real que `drizzle-kit generate` cria (Task 1 Step 4 anota). Há duas "Decisões do implementer" explícitas (o `estacaoNome` no título da TV; o pareamento client-side) — ambas resolvidas no texto, não deixadas em aberto.

**3. Consistência de tipos:** `TelaView`/`TelaInput`/`TelaResolvida`/`DadosTv` definidos na Task 2 e consumidos nas Tasks 3-4 com os mesmos campos. `validarTela({nome,modo,estacaoId})` idêntico entre domínio (Task 1) e uso (Task 2). `pode(sessao.permissoes, "config:editar")` (modelo P-1) usado uniformemente nas Tasks 2/4. `notificarPainel(tenantId)` e `RealtimePainel({tenantId})` reusados com a assinatura real verificada.

**4. Ponto de atenção honesto (para o revisor):** o `entrar-tela.tsx` redireciona para `/tv/{codigo}` e a rota `/tv/[token]` resolve via `resolverTelaPorToken`, que aceita token OU código curto — então o código curto vira uma credencial de URL (adivinhável). Mitigação: o `resolverTelaPorToken` só resolve tela ATIVA, e a rota `/tv/[token]` tem rate-limit por IP (espelha o quiosque, que tem o mesmo trade-off e foi auditado). Isso é aceitável e consistente com o quiosque; se o revisor discordar, é decisão de produto (endurecer = exigir o token pleno após o primeiro pareamento), fora do escopo desta leva.
