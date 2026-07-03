# Quiosque de Setor + PIN (P-0) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que a equipe do chão avance OS num tablet-quiosque logado NO SETOR (token forte, sem senha o dia todo), carimbando QUEM avançou por um PIN individual de 4 dígitos.

**Architecture:** Duas credenciais. O tablet do box é autenticado por um **token de quiosque** forte (32 bytes → sha256 guardado), emitido pelo admin, escopado a uma estação — mesmíssimo padrão do portal do cliente (`resolverToken` → `withTenant`). Ao dar o bump, um **PIN de 4 dígitos** (sha256 em `usuario.pin_hash`) só CARIMBA a autoria (`porUsuarioId`); PIN errado não destranca nada. Acesso sem sessão de cookie, resolvido em 2 etapas, isolado por tenant.

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), TypeScript strict, Drizzle + Postgres (Supabase), RLS multi-tenant via `withTenant` (`SET LOCAL app.current_tenant` + `role app_user`), Vitest, `node:crypto`.

## Global Constraints

- **Schema/migration primeiro**, uma fatia por vez; **migrations só via Drizzle** (`pnpm db:generate` → editar SQL RLS à mão quando preciso → `pnpm db:migrate`). Nunca SQL manual em prod.
- **Toda tabela nova com dado de tenant nasce com `tenant_id` + política RLS na MESMA migration** (regra de ouro #7). RLS de tabela nova = `GRANT ... TO app_user` + `ENABLE ROW LEVEL SECURITY` (SEM `FORCE`, como 0007/0011) + policy `USING/WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)`.
- **Teste de isolamento multi-tenant obrigatório** em cada fatia que toca dados: tenant A nunca vê/toca/resolve dado de B.
- **Verificação a cada fatia:** `pnpm typecheck` && `pnpm lint` && `pnpm build` && `pnpm test`. **CI verde antes do deploy.** Deploy por `railway up --service igni-app --ci`. **SEM Playwright.**
- **Segredos e tokens:** guardar só o **hash** (`sha256`), nunca o valor cru (padrão do portal). Token de quiosque = `randomBytes(32).toString("base64url")`. PIN = 4 dígitos, `sha256` em `usuario.pin_hash`.
- **Boundary guard (ESLint):** `src/app/**` NUNCA importa `db`/`database` de `@/infra/db/client`; sempre via camada de composição (`@/infra/composition/*`).
- **DB de teste:** Docker `igni-db` na porta 5433 (`TEST_DATABASE_URL`). `resetAndMigrate()` + `createTestDatabase()`. Se o Docker local estiver fora, os testes rodam no CI (Postgres limpo).
- **Money/datas:** N/A nesta feature. **PIN e token nunca aparecem em log** (o projeto não tem `console.log`; manter assim).

---

## File Structure

**Schema (Drizzle):**
- Create `src/infra/db/schema/quiosque-setor.ts` — tabela `quiosque_setor`.
- Modify `src/infra/db/schema/usuario.ts` — coluna `pinHash`.
- Modify `src/infra/db/schema/index.ts` — reexport da tabela nova.
- Create migration `NNNN_*.sql` (gerada) + migration RLS custom para `quiosque_setor`.

**Domínio (puro):**
- Create `src/domain/os/pin.ts` — validação/normalização do PIN (4 dígitos).
- Create `src/domain/os/quiosque.ts` — geração do código curto (alfabeto seguro), rótulos.

**Aplicação (recebe `Database`, abre `withTenant`):**
- Create `src/application/quiosque.ts` — gerar token, resolver token (2 etapas), listar OS do setor, resolver PIN→usuario, bump-por-quiosque, revogar, definir/limpar PIN.

**Composição (liga ao `database`, injeta deps):**
- Create `src/infra/composition/quiosque.ts` — wrappers `*NoTenant` + resolução pública por token.

**Infra:**
- Modify `src/infra/lgpd.ts` — N/A (sem dado pessoal novo).

**Web (Next):**
- Create `src/app/quiosque/[token]/page.tsx` — a tela do tablet (RSC, resolve por token).
- Create `src/app/quiosque/[token]/quiosque-chao.tsx` — client: cards + teclado de PIN.
- Create `src/app/quiosque/[token]/actions.ts` — server actions públicas (bump com PIN, travar/destravar).
- Create `src/app/quiosque/entrar/page.tsx` + `actions.ts` — entrada pelo código curto (troca por token → redirect).
- Modify `src/app/config/estacoes/*` — gerar/revogar quiosque por estação (composição + UI).
- Modify `src/app/config/equipe/*` — definir/resetar PIN de membro de produção.
- Modify `src/infra/auth/supabase-middleware.ts` — liberar `/quiosque` (rota pública, credencial = token).

**Testes:**
- Create `src/infra/db/__tests__/quiosque-isolation.test.ts` (isolamento RLS da tabela nova).
- Create `src/application/__tests__/quiosque.test.ts` (fluxo + isolamento + segurança).
- Create `src/domain/os/__tests__/pin.test.ts` e `quiosque.test.ts` (puros).

---

## Task 1: Schema + migration (usuario.pin_hash + quiosque_setor + RLS)

**Files:**
- Modify: `src/infra/db/schema/usuario.ts`
- Create: `src/infra/db/schema/quiosque-setor.ts`
- Modify: `src/infra/db/schema/index.ts`
- Create: `src/infra/db/migrations/NNNN_*.sql` (gerada pelo drizzle-kit) + edição RLS à mão
- Test: `src/infra/db/__tests__/quiosque-isolation.test.ts`

**Interfaces:**
- Produces: tabela Drizzle `quiosqueSetor` com colunas `id, tenantId, estacaoId, tokenHash, codigoCurto, criadoPor, revogadoEm, ultimoUsoEm, createdAt`; coluna `usuario.pinHash`.

- [ ] **Step 1: Adicionar `pinHash` ao schema `usuario`**

Modify `src/infra/db/schema/usuario.ts` — dentro do objeto de colunas, após `desativadoEm`:

```typescript
    // Quiosque de setor (P-0): hash do PIN de 4 dígitos que CARIMBA quem avançou no chão.
    // Só produção usa; nulo para os demais. Nunca o PIN cru — sha256, como o token do portal.
    pinHash: text("pin_hash"),
```

- [ ] **Step 2: Criar o schema da tabela `quiosque_setor`**

Create `src/infra/db/schema/quiosque-setor.ts`:

```typescript
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { estacao } from "./estacao";
import { tenant } from "./tenant";
import { usuario } from "./usuario";

/**
 * Quiosque de setor (P-0): o "tablet logado no setor". Credencial forte de DISPOSITIVO
 * (token de 32 bytes; só o `token_hash` mora aqui, como o portal). Escopo mínimo: só serve
 * uma estação. Longo-vivo (fica no tablet); o controle é a REVOGAÇÃO manual (`revogado_em`).
 * O `codigo_curto` é atalho de backup pra ligar (troca-se pelo token; não é credencial permanente).
 */
export const quiosqueSetor = pgTable("quiosque_setor", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  estacaoId: uuid("estacao_id")
    .notNull()
    .references(() => estacao.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  codigoCurto: text("codigo_curto").notNull().unique(),
  criadoPor: uuid("criado_por").references(() => usuario.id, { onDelete: "set null" }),
  revogadoEm: timestamp("revogado_em", { withTimezone: true }),
  ultimoUsoEm: timestamp("ultimo_uso_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 3: Reexportar no barrel**

Modify `src/infra/db/schema/index.ts` — adicionar após `export * from "./tenant-contador-os";`:

```typescript
export * from "./quiosque-setor";
```

- [ ] **Step 4: Gerar a migration**

Run: `pnpm db:generate`
Expected: cria `src/infra/db/migrations/NNNN_<slug>.sql` com `ALTER TABLE "usuario" ADD COLUMN "pin_hash" text;` e `CREATE TABLE "quiosque_setor" (...)` + as FKs. (Sem migration = FALHA; confira o arquivo.)

- [ ] **Step 5: Criar a migration RLS custom da tabela nova**

Descubra o número da PRÓXIMA migration (o arquivo gerado no Step 4 é `NNNN`; esta é `NNNN+1`). Create `src/infra/db/migrations/<NNNN+1>_rls_quiosque_setor.sql`:

```sql
-- RLS multi-tenant do quiosque de setor (P-0). Mesmo padrão do 0007/0011:
-- GRANT ao app_user + ENABLE (SEM FORCE) + política de isolamento por tenant.
-- `app_user` já existe (migration 0001).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "quiosque_setor" TO app_user;--> statement-breakpoint

ALTER TABLE "quiosque_setor" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY quiosque_setor_tenant_isolation ON "quiosque_setor"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
```

Depois adicione a linha desta migration ao journal do drizzle **manualmente** se o `db:generate` não a reconhecer: verifique `src/infra/db/migrations/meta/_journal.json` e confirme que a migration custom aparece na sequência (o padrão do projeto: as `*_rls_*.sql` são migrations próprias na sequência). Se necessário, rode `pnpm db:generate` novamente com um no-op ou siga o padrão exato das `0007/0009/0011` já existentes (elas estão no journal).

- [ ] **Step 6: Escrever o teste de isolamento (RED)**

Create `src/infra/db/__tests__/quiosque-isolation.test.ts`:

```typescript
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/infra/db/connection";
import { estacao, quiosqueSetor, tenant, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

/** Isolamento RLS da tabela quiosque_setor (regra de ouro #7): A nunca vê/toca o quiosque de B. */
describe("isolamento multi-tenant — quiosque_setor (RLS)", () => {
  let database: Database;
  let tenantA: string;
  let tenantB: string;
  let estacaoA: string;
  let estacaoB: string;

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

    const [a] = await database.db
      .insert(tenant).values({ nome: "A", templateRamo: "retifica_leve" }).returning();
    const [b] = await database.db
      .insert(tenant).values({ nome: "B", templateRamo: "centro_automotivo" }).returning();
    tenantA = a!.id;
    tenantB = b!.id;
    const [ea] = await database.db
      .insert(estacao).values({ tenantId: tenantA, nome: "Bloco", ordem: 1 }).returning();
    const [eb] = await database.db
      .insert(estacao).values({ tenantId: tenantB, nome: "Bloco", ordem: 1 }).returning();
    estacaoA = ea!.id;
    estacaoB = eb!.id;
  });

  it("A enxerga apenas os próprios quiosques", async () => {
    await database.db.insert(quiosqueSetor).values({
      tenantId: tenantA, estacaoId: estacaoA, tokenHash: "hashA", codigoCurto: "BLOCO-AAAA",
    });
    await database.db.insert(quiosqueSetor).values({
      tenantId: tenantB, estacaoId: estacaoB, tokenHash: "hashB", codigoCurto: "BLOCO-BBBB",
    });

    const vistos = await database.withTenant(tenantA, (tx) => tx.select().from(quiosqueSetor));
    expect(vistos).toHaveLength(1);
    expect(vistos[0]!.tenantId).toBe(tenantA);
  });

  it("a RLS barra ESCREVER um quiosque marcado como de outro tenant (WITH CHECK)", async () => {
    await expect(
      database.withTenant(tenantA, (tx) =>
        tx.insert(quiosqueSetor).values({
          tenantId: tenantB, estacaoId: estacaoB, tokenHash: "hx", codigoCurto: "BLOCO-XXXX",
        }),
      ),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 7: Aplicar a migration no DB de teste e rodar (deve passar)**

Run: `docker start igni-db` (se não estiver de pé) e `pnpm test src/infra/db/__tests__/quiosque-isolation.test.ts`
Expected: PASS (o `resetAndMigrate` aplica todas as migrations, incluindo a RLS nova). Se falhar por "relation quiosque_setor does not exist", a migration não entrou no journal — reveja o Step 5.

- [ ] **Step 8: typecheck + commit**

Run: `pnpm typecheck`
Expected: sem erros.

```bash
git add src/infra/db/schema/ src/infra/db/migrations/ src/infra/db/__tests__/quiosque-isolation.test.ts
git commit -m "feat(quiosque): schema usuario.pin_hash + tabela quiosque_setor + RLS (P-0 fatia 1)"
```

---

## Task 2: Domínio puro (PIN + código curto)

**Files:**
- Create: `src/domain/os/pin.ts`
- Create: `src/domain/os/quiosque.ts`
- Test: `src/domain/os/__tests__/pin.test.ts`, `src/domain/os/__tests__/quiosque.test.ts`

**Interfaces:**
- Produces: `pinValido(pin: string): boolean` (exatamente 4 dígitos); `normalizarPin(pin: string): string | null`; `gerarCodigoCurto(nomeEstacao: string, sufixoAleatorio: string): string`; `PREFIXO_MAX` e `ALFABETO_CODIGO`.

- [ ] **Step 1: Teste do PIN (RED)**

Create `src/domain/os/__tests__/pin.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { normalizarPin, pinValido } from "@/domain/os/pin";

describe("pin — validação (4 dígitos, carimbo de autoria)", () => {
  it("aceita exatamente 4 dígitos", () => {
    expect(pinValido("1234")).toBe(true);
    expect(pinValido("0000")).toBe(true);
  });
  it("rejeita tamanho errado ou não-dígito", () => {
    expect(pinValido("123")).toBe(false);
    expect(pinValido("12345")).toBe(false);
    expect(pinValido("12a4")).toBe(false);
    expect(pinValido("")).toBe(false);
  });
  it("normalizarPin apara e valida; inválido → null", () => {
    expect(normalizarPin("  1234 ")).toBe("1234");
    expect(normalizarPin("12")).toBeNull();
    expect(normalizarPin("abcd")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pnpm test src/domain/os/__tests__/pin.test.ts`
Expected: FAIL ("Cannot find module '@/domain/os/pin'").

- [ ] **Step 3: Implementar o PIN**

Create `src/domain/os/pin.ts`:

```typescript
/**
 * PIN do chão (P-0): 4 dígitos que CARIMBAM quem avançou a OS no quiosque. Lógica pura.
 * Não é credencial de acesso (a porta é o token do quiosque) — só autoria. Guardado como hash.
 */
export function pinValido(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export function normalizarPin(pin: string | null | undefined): string | null {
  const limpo = (pin ?? "").trim();
  return pinValido(limpo) ? limpo : null;
}
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `pnpm test src/domain/os/__tests__/pin.test.ts`
Expected: PASS.

- [ ] **Step 5: Teste do código curto (RED)**

Create `src/domain/os/__tests__/quiosque.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { ALFABETO_CODIGO, gerarCodigoCurto } from "@/domain/os/quiosque";

describe("quiosque — código curto de backup", () => {
  it("monta PREFIXO-SUFIXO em maiúsculas, prefixo do nome do setor", () => {
    expect(gerarCodigoCurto("Bloco", "4K2P")).toBe("BLOCO-4K2P");
  });
  it("corta prefixo longo e tira não-letras", () => {
    expect(gerarCodigoCurto("Controle de Qualidade", "7X9Z")).toBe("CONTR-7X9Z");
  });
  it("prefixo vazio vira 'SETOR'", () => {
    expect(gerarCodigoCurto("   ", "1A2B")).toBe("SETOR-1A2B");
  });
  it("o alfabeto não tem caracteres ambíguos (0/O/1/I)", () => {
    expect(ALFABETO_CODIGO).not.toMatch(/[01OI]/);
  });
});
```

- [ ] **Step 6: Rodar (deve falhar)**

Run: `pnpm test src/domain/os/__tests__/quiosque.test.ts`
Expected: FAIL ("Cannot find module '@/domain/os/quiosque'").

- [ ] **Step 7: Implementar o código curto**

Create `src/domain/os/quiosque.ts`:

```typescript
/**
 * Quiosque de setor (P-0) — regras puras do CÓDIGO CURTO de backup. O código é só um atalho pra
 * ligar o tablet (troca-se pelo token forte no servidor); nunca é credencial permanente. Alfabeto
 * sem caracteres ambíguos (é ditado/digitado no chão). O sufixo aleatório vem da infra (crypto).
 */
export const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Prefixo legível (máx. 5 letras do nome do setor) + "-" + sufixo aleatório. Ex.: "BLOCO-4K2P". */
export function gerarCodigoCurto(nomeEstacao: string, sufixoAleatorio: string): string {
  const soLetras = nomeEstacao.toUpperCase().replace(/[^A-Z]/g, "");
  const prefixo = soLetras.slice(0, 5) || "SETOR";
  return `${prefixo}-${sufixoAleatorio}`;
}
```

- [ ] **Step 8: Rodar (deve passar) + typecheck + commit**

Run: `pnpm test src/domain/os/__tests__/pin.test.ts src/domain/os/__tests__/quiosque.test.ts && pnpm typecheck`
Expected: PASS, sem erros de tipo.

```bash
git add src/domain/os/pin.ts src/domain/os/quiosque.ts src/domain/os/__tests__/
git commit -m "feat(quiosque): domínio puro do PIN e do código curto (P-0 fatia 2a)"
```

---

## Task 3: Aplicação — gerar/revogar quiosque, definir PIN

**Files:**
- Create: `src/application/quiosque.ts`
- Test: `src/application/__tests__/quiosque.test.ts` (parte 1)

**Interfaces:**
- Consumes: `Database` (`@/infra/db/connection`), `SessaoTenant` (`@/application/abrir-os`), `gerarCodigoCurto`/`ALFABETO_CODIGO` (`@/domain/os/quiosque`), `normalizarPin` (`@/domain/os/pin`), schema (`quiosqueSetor`, `estacao`, `usuario`).
- Produces:
  - `gerarQuiosque(db, sessao, estacaoId): Promise<{ token: string; codigoCurto: string }>`
  - `revogarQuiosque(db, sessao, quiosqueId): Promise<void>`
  - `listarQuiosques(db, sessao): Promise<QuiosqueView[]>` onde `QuiosqueView = { id; estacaoId; estacaoNome; codigoCurto; ativo; ultimoUsoEm: Date | null }`
  - `definirPin(db, sessao, usuarioId, pin): Promise<void>` (lança `DadosInvalidosError` se PIN inválido ou usuário não é produção)
  - `limparPin(db, sessao, usuarioId): Promise<void>`
  - helper interno `hash(valor: string): string` (sha256 hex) — mesma do portal.

- [ ] **Step 1: Teste (RED) — gerar quiosque cria registro com hash e código, escopado ao tenant**

Create `src/application/__tests__/quiosque.test.ts`:

```typescript
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SessaoTenant } from "@/application/abrir-os";
import {
  definirPin,
  gerarQuiosque,
  listarQuiosques,
  revogarQuiosque,
} from "@/application/quiosque";
import type { Database } from "@/infra/db/connection";
import { estacao, quiosqueSetor, tenant, usuario } from "@/infra/db/schema";
import { createTestDatabase, resetAndMigrate } from "@/test/db";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

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
    expect(linha!.tokenHash).toBe(sha(r.token)); // guarda o HASH, nunca o cru
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
    expect(u!.pinHash).toBe(sha("1234"));
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
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pnpm test src/application/__tests__/quiosque.test.ts`
Expected: FAIL ("Cannot find module '@/application/quiosque'").

- [ ] **Step 3: Implementar a aplicação (parte admin)**

Create `src/application/quiosque.ts`:

```typescript
import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { normalizarPin } from "@/domain/os/pin";
import { ALFABETO_CODIGO, gerarCodigoCurto } from "@/domain/os/quiosque";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { estacao, quiosqueSetor, usuario } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/** sha256 hex — guardamos SÓ o hash de token/PIN, nunca o valor cru (padrão do portal). */
function hash(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

/** Sufixo aleatório do código curto (4 chars do alfabeto sem ambíguos), via crypto. */
function sufixoCodigo(): string {
  const bytes = randomBytes(4);
  return Array.from(bytes, (b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join("");
}

export interface QuiosqueView {
  id: string;
  estacaoId: string;
  estacaoNome: string;
  codigoCurto: string;
  ativo: boolean;
  ultimoUsoEm: Date | null;
}

/**
 * Admin gera o quiosque de um setor: cria o token forte (devolve o CRU uma vez p/ o QR), guarda só
 * o hash + o código curto único. Escopado ao tenant (RLS). Regenera o código se colidir (raro).
 */
export async function gerarQuiosque(
  database: Database,
  sessao: SessaoTenant,
  estacaoId: string,
): Promise<{ token: string; codigoCurto: string }> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [est] = await tx
      .select({ nome: estacao.nome })
      .from(estacao)
      .where(eq(estacao.id, estacaoId))
      .limit(1);
    if (!est) {
      throw new DadosInvalidosError("Estação não encontrada.");
    }
    const token = randomBytes(32).toString("base64url");
    // Tenta até um código curto único (UNIQUE global; colisão é rara).
    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      const codigoCurto = gerarCodigoCurto(est.nome, sufixoCodigo());
      try {
        await tx.insert(quiosqueSetor).values({
          tenantId: sessao.tenantId,
          estacaoId,
          tokenHash: hash(token),
          codigoCurto,
          criadoPor: sessao.usuarioId,
        });
        return { token, codigoCurto };
      } catch (err) {
        // colisão de codigo_curto UNIQUE → tenta de novo; outro erro → propaga
        if (tentativa === 4) {
          throw err;
        }
      }
    }
    throw new DadosInvalidosError("Não foi possível gerar o quiosque. Tente de novo.");
  });
}

/** Revoga (desliga) um quiosque: mata o token na hora. RLS garante que só o próprio tenant revoga. */
export function revogarQuiosque(
  database: Database,
  sessao: SessaoTenant,
  quiosqueId: string,
): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx
      .update(quiosqueSetor)
      .set({ revogadoEm: new Date() })
      .where(eq(quiosqueSetor.id, quiosqueId));
  });
}

/** Lista os quiosques do tenant (com nome do setor e se está ativo) — pra tela de Estações. */
export function listarQuiosques(database: Database, sessao: SessaoTenant): Promise<QuiosqueView[]> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const linhas = await tx
      .select({
        id: quiosqueSetor.id,
        estacaoId: quiosqueSetor.estacaoId,
        estacaoNome: estacao.nome,
        codigoCurto: quiosqueSetor.codigoCurto,
        revogadoEm: quiosqueSetor.revogadoEm,
        ultimoUsoEm: quiosqueSetor.ultimoUsoEm,
      })
      .from(quiosqueSetor)
      .innerJoin(estacao, eq(estacao.id, quiosqueSetor.estacaoId));
    return linhas.map((l) => ({
      id: l.id,
      estacaoId: l.estacaoId,
      estacaoNome: l.estacaoNome,
      codigoCurto: l.codigoCurto,
      ativo: l.revogadoEm === null,
      ultimoUsoEm: l.ultimoUsoEm,
    }));
  });
}

/** Admin define/reseta o PIN de um membro de PRODUÇÃO. Guarda só o hash. */
export function definirPin(
  database: Database,
  sessao: SessaoTenant,
  usuarioId: string,
  pinBruto: string,
): Promise<void> {
  const pin = normalizarPin(pinBruto);
  if (!pin) {
    throw new DadosInvalidosError("O PIN deve ter 4 dígitos.");
  }
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [alvo] = await tx
      .select({ papel: usuario.papel })
      .from(usuario)
      .where(eq(usuario.id, usuarioId))
      .limit(1);
    if (!alvo) {
      throw new DadosInvalidosError("Membro não encontrado.");
    }
    if (alvo.papel !== "producao") {
      throw new DadosInvalidosError("O PIN é só para a equipe de produção (chão).");
    }
    await tx.update(usuario).set({ pinHash: hash(pin) }).where(eq(usuario.id, usuarioId));
  });
}

/** Remove o PIN de um membro. */
export function limparPin(
  database: Database,
  sessao: SessaoTenant,
  usuarioId: string,
): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx.update(usuario).set({ pinHash: null }).where(eq(usuario.id, usuarioId));
  });
}
```

- [ ] **Step 4: Rodar (deve passar) + typecheck**

Run: `pnpm test src/application/__tests__/quiosque.test.ts && pnpm typecheck`
Expected: PASS, sem erros. Se `randomBytes(4)` gerar índices duplicados, o teste não depende do valor — só do prefixo.

- [ ] **Step 5: Commit**

```bash
git add src/application/quiosque.ts src/application/__tests__/quiosque.test.ts
git commit -m "feat(quiosque): aplicação admin — gerar/revogar quiosque + definir PIN (P-0 fatia 2b)"
```

---

## Task 4: Aplicação — resolver token (2 etapas), listar OS do setor, bump com PIN

**Files:**
- Modify: `src/application/quiosque.ts` (adiciona a parte pública)
- Modify: `src/application/__tests__/quiosque.test.ts` (parte 2)

**Interfaces:**
- Consumes: `executarTransicao` (`@/application/executar-transicao`) para reusar a máquina de estados/gates; `resolverContextoGate` do orçamento? — NÃO: o quiosque não avança para execução via gate de orçamento (isso é do chão); reusa `executarTransicao` com o `contexto` já resolvido. Para simplicidade e escopo, o bump do quiosque resolve o contexto de gate como o `/chao` faz hoje (via composição). Ver Step 3.
- Produces:
  - `resolverQuiosque(db, token, agora): Promise<{ tenantId: string; estacaoId: string; quiosqueId: string } | null>` (etapa 1, privilegiada; null se inválido/revogado)
  - `resolverPorCodigoCurto(db, codigo): Promise<{ token: never } | null>` — NÃO: o código curto não devolve o token (que só existe cru na geração). Em vez disso: `tokenHashPorCodigo` não é possível (não temos o token). **Decisão:** o código curto resolve direto para o quiosque (etapa 1 aceita OU token OU código curto). Ver Step 1.
  - `bumpPorQuiosque(db, token, osId, para, pin, agora): Promise<ResultadoQuiosque>` onde `ResultadoQuiosque = { ok: boolean; motivo?: string }`.

- [ ] **Step 1: Ajuste de design do código curto (decisão registrada)**

O token CRU só existe no momento da geração (guardamos o hash). Logo, o **código curto não pode “virar” o token**. Correção do design: a **etapa 1 de resolução aceita o TOKEN (via `token_hash`) OU o código curto (via `codigo_curto`)** — os dois resolvem o mesmo registro `quiosque_setor`. A URL do QR usa o token; a entrada por código curto usa o código. Ambos levam ao mesmo `quiosqueId`/`estacaoId`/`tenantId`. O código curto, por ser adivinhável, é protegido por **rate-limit** na rota de entrada (Task 7). Registre isto no spec depois (nota).

- [ ] **Step 2: Teste (RED) — resolução e bump com PIN**

Adicione ao `src/application/__tests__/quiosque.test.ts` um novo `describe` (mesmo arquivo, após o existente):

```typescript
import { abrirOS } from "@/application/abrir-os";
import { bumpPorQuiosque, resolverQuiosque } from "@/application/quiosque";
import { evento, os } from "@/infra/db/schema";

describe("quiosque — público (resolver token + bump com PIN)", () => {
  let database: Database;
  let sessaoA: SessaoTenant;
  let estacaoA: string;
  let prodA: string;
  let tokenA: string;

  beforeAll(async () => {
    await resetAndMigrate();
    database = createTestDatabase();
  });
  afterAll(async () => {
    await database.close();
  });
  beforeEach(async () => {
    await database.db.delete(evento);
    await database.db.delete(os);
    await database.db.delete(quiosqueSetor);
    await database.db.delete(estacao);
    // entrada/equipamento/cliente limpos pelo abrirOS? não — limpe na ordem das FKs:
    await database.db.execute?.(undefined as never); // placeholder-safe no-op removido no fix
  });

  // NOTE: para manter o teste enxuto, este describe recria só o necessário via abrirOS.
});
```

> **Correção do Step 2 (o bloco acima tem um placeholder proibido).** Reescreva o `beforeEach` deste describe seguindo o padrão do `demonstracao.test.ts`/`cliente.test.ts` (deletar na ordem das FKs: `evento, os, entrada, equipamento, cliente, quiosqueSetor, estacao, usuario, tenant`), recriar tenant A + admin + um usuário `producao` com PIN, uma estação, um quiosque (via `gerarQuiosque`, guardando `tokenA`), e uma OS na estação (via `abrirOS`, depois `update os set estacao_id = estacaoA, estado='execucao'`). Então os testes:

```typescript
  it("resolverQuiosque devolve tenant+estacao do registro (não do input); revogado → null", async () => {
    const r = await resolverQuiosque(database, tokenA, new Date());
    expect(r).not.toBeNull();
    expect(r!.tenantId).toBe(sessaoA.tenantId);
    expect(r!.estacaoId).toBe(estacaoA);
  });

  it("bump com PIN CERTO avança a OS e carimba o usuário do PIN, origem=chao", async () => {
    // (osId de uma OS na estacaoA em estado que permita bump para controle_qualidade)
    const r = await bumpPorQuiosque(database, tokenA, osId, "controle_qualidade", "1234", new Date());
    expect(r.ok).toBe(true);
    const [ev] = await database.db.select().from(evento).where(eq(evento.osId, osId)).orderBy(/* desc em */);
    expect(ev!.porUsuarioId).toBe(prodA);
    expect(ev!.origem).toBe("chao");
  });

  it("bump com PIN ERRADO não avança nada", async () => {
    const r = await bumpPorQuiosque(database, tokenA, osId, "controle_qualidade", "9999", new Date());
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/pin/i);
  });

  it("token revogado não resolve (bump falha)", async () => {
    const [q] = await database.db.select().from(quiosqueSetor).limit(1);
    await database.db.update(quiosqueSetor).set({ revogadoEm: new Date() }).where(eq(quiosqueSetor.id, q!.id));
    const r = await bumpPorQuiosque(database, tokenA, osId, "controle_qualidade", "1234", new Date());
    expect(r.ok).toBe(false);
  });
```

> Ao implementar o teste, complete os `osId`/ordenação conforme o padrão do `orcamento.test.ts` (que usa `orderBy(desc(evento.em))`). Sem placeholders no arquivo final.

- [ ] **Step 3: Implementar a parte pública em `src/application/quiosque.ts`**

Adicione ao final de `src/application/quiosque.ts`:

```typescript
import { desc } from "drizzle-orm";
import { validarTransicao, type EstadoOS } from "@/domain/os/estado";
import { os, evento } from "@/infra/db/schema";

export interface QuiosqueResolvido {
  tenantId: string;
  estacaoId: string;
  quiosqueId: string;
}

/**
 * Etapa 1 (PRIVILEGIADA, mínima): resolve o quiosque por TOKEN (token_hash) OU por código curto.
 * O tenant/estação vêm do REGISTRO, nunca do input. Null se não existe ou está revogado.
 */
export async function resolverQuiosque(
  database: Database,
  tokenOuCodigo: string,
  _agora: Date,
): Promise<QuiosqueResolvido | null> {
  if (!tokenOuCodigo || tokenOuCodigo.length < 4) {
    return null;
  }
  const [row] = await database.db
    .select({
      id: quiosqueSetor.id,
      tenantId: quiosqueSetor.tenantId,
      estacaoId: quiosqueSetor.estacaoId,
      revogadoEm: quiosqueSetor.revogadoEm,
      tokenHash: quiosqueSetor.tokenHash,
      codigoCurto: quiosqueSetor.codigoCurto,
    })
    .from(quiosqueSetor)
    .where(eq(quiosqueSetor.tokenHash, hash(tokenOuCodigo)))
    .limit(1);
  // tenta como token; se não achou, tenta como código curto (entrada de backup)
  const linha =
    row ??
    (
      await database.db
        .select({
          id: quiosqueSetor.id,
          tenantId: quiosqueSetor.tenantId,
          estacaoId: quiosqueSetor.estacaoId,
          revogadoEm: quiosqueSetor.revogadoEm,
        })
        .from(quiosqueSetor)
        .where(eq(quiosqueSetor.codigoCurto, tokenOuCodigo))
        .limit(1)
    )[0];
  if (!linha || linha.revogadoEm !== null) {
    return null;
  }
  return { tenantId: linha.tenantId, estacaoId: linha.estacaoId, quiosqueId: linha.id };
}

export interface ResultadoQuiosque {
  ok: boolean;
  motivo?: string;
}

/**
 * Bump pelo quiosque: resolve o quiosque (etapa 1) → dentro do tenant, confere que a OS é do SETOR
 * do quiosque → valida a transição → resolve o PIN em um usuário `producao` do tenant (carimbo) →
 * grava a transição com `porUsuarioId` = usuário do PIN e `origem='chao'`. PIN errado NÃO destranca.
 */
export async function bumpPorQuiosque(
  database: Database,
  token: string,
  osId: string,
  para: EstadoOS,
  pinBruto: string,
  agora: Date,
): Promise<ResultadoQuiosque> {
  const q = await resolverQuiosque(database, token, agora);
  if (!q) {
    return { ok: false, motivo: "Quiosque desligado. Peça um novo ao escritório." };
  }
  const pin = normalizarPin(pinBruto);
  if (!pin) {
    return { ok: false, motivo: "PIN inválido (4 dígitos)." };
  }
  return database.withTenant(q.tenantId, async (tx) => {
    // 1) PIN → usuário produção do tenant (carimbo). Não achou = PIN não confere (não destranca).
    const [autor] = await tx
      .select({ id: usuario.id })
      .from(usuario)
      .where(and(eq(usuario.pinHash, hash(pin)), eq(usuario.papel, "producao")))
      .limit(1);
    if (!autor) {
      return { ok: false, motivo: "PIN não confere. Tente de novo." };
    }
    // 2) A OS tem que ser do SETOR do quiosque (escopo mínimo).
    const [ordem] = await tx
      .select({ estado: os.estado, estacaoId: os.estacaoId, cqAprovado: os.cqAprovado })
      .from(os)
      .where(eq(os.id, osId))
      .limit(1);
    if (!ordem || ordem.estacaoId !== q.estacaoId) {
      return { ok: false, motivo: "Esta OS não é deste setor." };
    }
    // 3) Valida a transição (gates lidos do dado, como o /chao). cqAprovado já lido acima.
    const contexto = { orcamentoAprovado: true, cqAprovado: ordem.cqAprovado };
    const veredito = validarTransicao(ordem.estado, para, contexto);
    if (!veredito.ok) {
      return { ok: false, motivo: veredito.motivo };
    }
    // 4) Aplica + carimba (porUsuarioId = autor do PIN, origem=chao).
    await tx
      .update(os)
      .set({
        estado: para,
        entrouNoEstadoEm: agora,
        ...(para === "controle_qualidade" ? { cqAprovado: false } : {}),
      })
      .where(eq(os.id, osId));
    await tx.insert(evento).values({
      tenantId: q.tenantId,
      osId,
      deEstado: ordem.estado,
      paraEstado: para,
      porUsuarioId: autor.id,
      origem: "chao",
    });
    // marca uso do quiosque
    await tx
      .update(quiosqueSetor)
      .set({ ultimoUsoEm: agora })
      .where(eq(quiosqueSetor.id, q.quiosqueId));
    return { ok: true };
  });
}
```

> **Nota de design (registrar no spec):** o quiosque resolve o contexto de gate de orçamento como `orcamentoAprovado: true` porque o bump do chão não deve barrar por falta de orçamento (isso é responsabilidade do escritório, e o gate de execução já foi cumprido antes da OS chegar ao setor físico). Se o piloto pedir gate estrito, trocar por leitura real do orçamento (como `resolverContextoGate`). Mantido simples nesta leva.

- [ ] **Step 4: Rodar (deve passar) + typecheck**

Run: `pnpm test src/application/__tests__/quiosque.test.ts && pnpm typecheck`
Expected: PASS. Ajuste imports duplicados (o `import { evento, os }` pode já existir no topo — consolide num único import).

- [ ] **Step 5: Commit**

```bash
git add src/application/quiosque.ts src/application/__tests__/quiosque.test.ts
git commit -m "feat(quiosque): resolver token (2 etapas) + bump com PIN, escopado ao setor (P-0 fatia 2c)"
```

---

## Task 5: Composição (liga ao database) + boundary

**Files:**
- Create: `src/infra/composition/quiosque.ts`
- Test: (coberto pelos testes de aplicação; a composição é fina)

**Interfaces:**
- Produces (todos injetam `database` e, quando muta OS, chamam `notificarPainel`):
  - `gerarQuiosqueNoTenant(sessao, estacaoId)`, `revogarQuiosqueNoTenant(sessao, quiosqueId)`, `listarQuiosquesNoTenant(sessao)`, `definirPinNoTenant(sessao, usuarioId, pin)`, `limparPinNoTenant(sessao, usuarioId)`
  - `resolverQuiosquePublico(token)`, `dadosQuiosque(token)` (lista OS do setor + nome do setor), `bumpQuiosquePublico(token, osId, para, pin)`, `travarQuiosquePublico(...)`/`destravarQuiosquePublico(...)`

- [ ] **Step 1: Implementar a composição**

Create `src/infra/composition/quiosque.ts`:

```typescript
import { desc, eq, ne } from "drizzle-orm";
import type { SessaoTenant } from "@/application/abrir-os";
import {
  bumpPorQuiosque,
  definirPin,
  gerarQuiosque,
  limparPin,
  listarQuiosques,
  type QuiosqueView,
  resolverQuiosque,
  revogarQuiosque,
} from "@/application/quiosque";
import type { EstadoOS } from "@/domain/os/estado";
import { proximoBump } from "@/domain/os/estado";
import { database } from "@/infra/db/client";
import { cliente, entrada, equipamento, estacao, os } from "@/infra/db/schema";
import { notificarPainel } from "@/infra/realtime/notificar";

export type { QuiosqueView };

// --- Admin (sessão) ---
export function gerarQuiosqueNoTenant(sessao: SessaoTenant, estacaoId: string) {
  return gerarQuiosque(database, sessao, estacaoId);
}
export function revogarQuiosqueNoTenant(sessao: SessaoTenant, quiosqueId: string) {
  return revogarQuiosque(database, sessao, quiosqueId);
}
export function listarQuiosquesNoTenant(sessao: SessaoTenant) {
  return listarQuiosques(database, sessao);
}
export function definirPinNoTenant(sessao: SessaoTenant, usuarioId: string, pin: string) {
  return definirPin(database, sessao, usuarioId, pin);
}
export function limparPinNoTenant(sessao: SessaoTenant, usuarioId: string) {
  return limparPin(database, sessao, usuarioId);
}

// --- Público (token) ---
export interface CardQuiosque {
  id: string;
  numero: number;
  equipamento: string;
  estado: EstadoOS;
  proximoBump: EstadoOS | null;
  travado: boolean;
}
export interface DadosQuiosque {
  estacaoNome: string;
  cards: CardQuiosque[];
}

/** Lista as OS ATIVAS do setor do quiosque (escopo mínimo: só o setor). Null se quiosque inválido. */
export async function dadosQuiosque(token: string): Promise<DadosQuiosque | null> {
  const q = await resolverQuiosque(database, token, new Date());
  if (!q) {
    return null;
  }
  return database.withTenant(q.tenantId, async (tx) => {
    const [est] = await tx.select({ nome: estacao.nome }).from(estacao).where(eq(estacao.id, q.estacaoId)).limit(1);
    const linhas = await tx
      .select({
        id: os.id,
        numero: os.numero,
        equipamento: equipamento.tipo,
        estado: os.estado,
        travado: os.travado,
      })
      .from(os)
      .innerJoin(equipamento, eq(equipamento.id, os.equipamentoId))
      .where(eq(os.estacaoId, q.estacaoId));
    return {
      estacaoNome: est?.nome ?? "Setor",
      cards: linhas
        .filter((l) => l.estado !== "entregue")
        .map((l) => ({
          id: l.id,
          numero: l.numero,
          equipamento: l.equipamento,
          estado: l.estado,
          proximoBump: proximoBump(l.estado),
          travado: l.travado,
        })),
    };
  });
}

export async function bumpQuiosquePublico(token: string, osId: string, para: EstadoOS, pin: string) {
  const r = await bumpPorQuiosque(database, token, osId, para, pin, new Date());
  if (r.ok) {
    const q = await resolverQuiosque(database, token, new Date());
    if (q) {
      await notificarPainel(q.tenantId);
    }
  }
  return r;
}
```

> Nota: `cliente`/`entrada` importados só se necessário; remova imports não usados antes do commit (o lint pega).

- [ ] **Step 2: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: sem erros; remova imports órfãos que o lint apontar.

- [ ] **Step 3: Commit**

```bash
git add src/infra/composition/quiosque.ts
git commit -m "feat(quiosque): composição admin + público (P-0 fatia 3)"
```

---

## Task 6: Admin UI — gerar/revogar quiosque nas Estações + PIN na Equipe

**Files:**
- Modify: `src/app/config/estacoes/actions.ts` (actions gerar/revogar)
- Modify: `src/app/config/estacoes/page.tsx` + `editor-estacoes.tsx` (mostrar quiosque + QR)
- Create: `src/app/config/estacoes/quiosque-modal.tsx` (client: QR + código curto)
- Modify: `src/app/config/equipe/actions.ts` (action definir/limpar PIN)
- Modify: `src/app/config/equipe/painel-equipe.tsx` (campo PIN p/ produção)
- Depend: adicionar a lib de QR (`qrcode`) OU gerar QR via API pública. **Decisão:** usar dependência `qrcode` (server-side, gera dataURL). Adicionar em `package.json`.

**Interfaces:**
- Consumes: composição da Task 5. Produce: as telas.

- [ ] **Step 1: Adicionar a lib de QR**

Run: `pnpm add qrcode && pnpm add -D @types/qrcode`
Expected: `qrcode` em dependencies. (Alternativa sem dependência: renderizar o QR com um componente SVG puro; se preferir zero-dep, pule e gere o QR no client com uma lib já presente — mas o projeto não tem uma, então `qrcode` é o caminho.)

- [ ] **Step 2: Actions de quiosque (estações)**

Modify `src/app/config/estacoes/actions.ts` — adicionar (seguindo o padrão `autorizar("config:editar")` já no arquivo):

```typescript
import {
  gerarQuiosqueNoTenant,
  revogarQuiosqueNoTenant,
} from "@/infra/composition/quiosque";
import QRCode from "qrcode";

export interface ResultadoQuiosque {
  ok: boolean;
  motivo?: string;
  qrDataUrl?: string;
  codigoCurto?: string;
  url?: string;
}

export async function acaoGerarQuiosque(estacaoId: string): Promise<ResultadoQuiosque> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    const { token, codigoCurto } = await gerarQuiosqueNoTenant(auth.sessao, estacaoId);
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://igni-app-production.up.railway.app";
    const url = `${base}/quiosque/${token}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1 });
    revalidatePath("/config/estacoes");
    return { ok: true, qrDataUrl, codigoCurto, url };
  } catch {
    return { ok: false, motivo: "Não foi possível gerar o quiosque. Tente novamente." };
  }
}

export async function acaoRevogarQuiosque(quiosqueId: string): Promise<{ ok: boolean; motivo?: string }> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await revogarQuiosqueNoTenant(auth.sessao, quiosqueId);
    revalidatePath("/config/estacoes");
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível revogar. Tente novamente." };
  }
}
```

- [ ] **Step 3: Passar os quiosques ativos para a tela de Estações**

Modify `src/app/config/estacoes/page.tsx` — carregar `listarQuiosquesNoTenant(sessao)` junto de `listarEstacoesNoTenant` e passar ao `EditorEstacoes` um mapa `estacaoId → quiosque`. (Siga o padrão do `Promise.all` já usado em outras páginas.)

- [ ] **Step 4: UI do quiosque no editor de estações**

Modify `src/app/config/estacoes/editor-estacoes.tsx` — em cada linha de estação, se houver quiosque ativo mostrar "Quiosque ativo · usado há X" + botão "Revogar"; senão botão "Ligar tablet" que chama `acaoGerarQuiosque` e abre o `QuiosqueModal` com o `qrDataUrl`/`codigoCurto`.

Create `src/app/config/estacoes/quiosque-modal.tsx` (client) — modal com `<img src={qrDataUrl} />` grande + o `codigoCurto` em mono grande + instrução "Aponte a câmera do tablet ou digite o código em /quiosque/entrar". Fecha no Escape (padrão do `modal-aprovacao.tsx`).

- [ ] **Step 5: PIN na tela de Equipe**

Modify `src/app/config/equipe/actions.ts` — adicionar `acaoDefinirPin(membroId, pin)` e `acaoLimparPin(membroId)` (autorizar `"usuario:gerenciar"`, validar `pinValido`, chamar `definirPinNoTenant`/`limparPinNoTenant`, `revalidatePath("/config/equipe")`).

Modify `src/app/config/equipe/painel-equipe.tsx` — para membros com `papel === "producao"`, mostrar um campo "PIN (4 dígitos)" com botão salvar (input `inputMode="numeric"` `maxLength={4}`), chamando `acaoDefinirPin`.

- [ ] **Step 6: Verificar**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: sem erros (o `build` valida que a rota compila e o `qrcode` server-side funciona).

- [ ] **Step 7: Commit**

```bash
git add src/app/config/ package.json pnpm-lock.yaml
git commit -m "feat(quiosque): admin gera/revoga quiosque nas Estações + define PIN na Equipe (P-0 fatia 4)"
```

---

## Task 7: Tablet — rota `/quiosque/[token]` + entrada por código curto + middleware

**Files:**
- Create: `src/app/quiosque/[token]/page.tsx`, `quiosque-chao.tsx`, `actions.ts`
- Create: `src/app/quiosque/entrar/page.tsx`, `actions.ts`
- Modify: `src/infra/auth/supabase-middleware.ts` (liberar `/quiosque`)

**Interfaces:**
- Consumes: `dadosQuiosque`, `bumpQuiosquePublico` (composição Task 5); `dentroDoLimite` (`@/infra/rate-limit`).

- [ ] **Step 1: Liberar `/quiosque` no middleware**

Modify `src/infra/auth/supabase-middleware.ts` — em `ROTAS_LIVRES`, adicionar `"/quiosque"`:

```typescript
const ROTAS_LIVRES = ["/recuperar", "/atualizar-senha", "/auth", "/portal", "/quiosque"];
```

- [ ] **Step 2: Server actions públicas do quiosque**

Create `src/app/quiosque/[token]/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import type { EstadoOS } from "@/domain/os/estado";
import { bumpQuiosquePublico } from "@/infra/composition/quiosque";

export interface ResultadoBumpQuiosque {
  ok: boolean;
  motivo?: string;
}

/** Bump pelo quiosque: token na URL + PIN digitado. Sem sessão; a credencial é o token. */
export async function acaoBumpQuiosque(
  token: string,
  osId: string,
  para: EstadoOS,
  pin: string,
): Promise<ResultadoBumpQuiosque> {
  const r = await bumpQuiosquePublico(token, osId, para, pin);
  if (r.ok) {
    revalidatePath(`/quiosque/${token}`);
  }
  return { ok: r.ok, motivo: r.motivo };
}
```

- [ ] **Step 3: A página do tablet (RSC + rate-limit)**

Create `src/app/quiosque/[token]/page.tsx` — resolve `dadosQuiosque(token)`; rate-limit por token (`dentroDoLimite(`quiosque-view:${token}`, { limite: 120, janelaMs: 60_000 })`); se null → tela "Quiosque desligado. Peça um novo ao escritório."; senão renderiza `<QuiosqueChao estacaoNome cards token />`. Tema escuro, cards grandes (padrão do `/chao`), sem AppShell.

- [ ] **Step 4: O client do chão com teclado de PIN**

Create `src/app/quiosque/[token]/quiosque-chao.tsx` (client) — cards com "PRONTO →" que, ao tocar, abre um **teclado numérico de 4 dígitos** (alvo grande, luva); ao completar 4 dígitos chama `acaoBumpQuiosque(token, osId, proximoBump, pin)`; mostra "Feito ✓" ou o motivo do erro ("PIN não confere"). Fecha o teclado no Escape. `useTransition` + `router.refresh()`.

- [ ] **Step 5: Entrada por código curto**

Create `src/app/quiosque/entrar/page.tsx` — input do código curto + submit para `acaoEntrarPorCodigo`. Create `src/app/quiosque/entrar/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolverQuiosque } from "@/application/quiosque";
import { database } from "@/infra/db/client"; // ⚠️ ver nota de boundary abaixo
import { dentroDoLimite } from "@/infra/rate-limit";
```

> **⚠️ Boundary:** `src/app` NÃO pode importar `database` direto. Portanto, adicione à composição (`src/infra/composition/quiosque.ts`) uma função `resolverEntradaPorCodigo(codigo): Promise<{ token: string } | null>` — mas o token cru NÃO existe (só o hash). **Correção:** a entrada por código curto deve redirecionar para `/quiosque/{codigoCurto}` diretamente (a rota `[token]` já aceita código curto OU token, pois `resolverQuiosque` tenta os dois). Então a action só valida o código via uma função de composição `validarCodigoQuiosque(codigo): Promise<boolean>` (rate-limited) e faz `redirect(`/quiosque/${codigo}`)`. Implemente `validarCodigoQuiosque` na composição chamando `resolverQuiosque(database, codigo, new Date()) !== null`.

Reescreva `actions.ts` de entrada:

```typescript
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { validarCodigoQuiosque } from "@/infra/composition/quiosque";
import { dentroDoLimite } from "@/infra/rate-limit";

export async function acaoEntrarPorCodigo(_prev: { erro?: string }, form: FormData): Promise<{ erro?: string }> {
  const codigo = String(form.get("codigo") ?? "").trim().toUpperCase();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!dentroDoLimite(`quiosque-codigo:${ip}`, { limite: 10, janelaMs: 60_000 })) {
    return { erro: "Muitas tentativas. Aguarde um instante." };
  }
  if (!codigo || !(await validarCodigoQuiosque(codigo))) {
    return { erro: "Código inválido ou desligado. Confira com o escritório." };
  }
  redirect(`/quiosque/${encodeURIComponent(codigo)}`);
}
```

Adicione `validarCodigoQuiosque` à composição:

```typescript
export async function validarCodigoQuiosque(codigo: string): Promise<boolean> {
  return (await resolverQuiosque(database, codigo, new Date())) !== null;
}
```

- [ ] **Step 6: Verificar**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: sem erros; o boundary guard do ESLint deve passar (nada em `src/app` importa `database`).

- [ ] **Step 7: Commit**

```bash
git add src/app/quiosque/ src/infra/auth/supabase-middleware.ts src/infra/composition/quiosque.ts
git commit -m "feat(quiosque): tablet /quiosque/[token] + entrada por código + middleware (P-0 fatia 5)"
```

---

## Task 8: Testes de segurança/isolamento finais + pipeline + deploy

**Files:**
- Modify: `src/application/__tests__/quiosque.test.ts` (casos de segurança finais)

**Interfaces:** nenhuma nova — endurece o que existe.

- [ ] **Step 1: Testes de isolamento/segurança adicionais**

Adicione ao `quiosque.test.ts` os casos:
- token de A **não** resolve OS de B (o `resolverQuiosque` devolve o tenant de A; a OS de B não é do `estacaoId` de A → bump falha "não é deste setor").
- PIN de produção de **B** não carimba bump em **A** (o `withTenant(A)` + `pinHash` de B não existe em A → "PIN não confere").
- quiosque de A escopa só o setor de A: `dadosQuiosque` do token de A nunca traz OS de outro setor/tenant.

```typescript
  it("isolamento: OS de outro tenant não é avançável pelo quiosque de A", async () => {
    // cria OS em B; tenta bump com token de A → 'não é deste setor' ou quiosque não resolve B
    const r = await bumpPorQuiosque(database, tokenA, osDeB, "controle_qualidade", "1234", new Date());
    expect(r.ok).toBe(false);
  });
```

- [ ] **Step 2: Suíte completa local (se Docker disponível)**

Run: `docker start igni-db` && `pnpm test`
Expected: todos verdes. Se o Docker local estiver fora, pule para o CI (Step 4).

- [ ] **Step 3: Pipeline completo**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: verdes.

- [ ] **Step 4: Commit + push + CI verde**

```bash
git add src/application/__tests__/quiosque.test.ts
git commit -m "test(quiosque): isolamento multi-tenant + segurança do PIN/token (P-0 fatia 6)"
git push origin main
```

Aguarde o CI (`gh run list --branch main --limit 1 --json status,conclusion`) ficar **success** antes do deploy. Se falhar, leia o log (`gh run view <id> --log-failed`), corrija, repita.

- [ ] **Step 5: Migration no cloud + deploy**

Antes do deploy do código que usa `quiosque_setor`/`pin_hash`, aplicar a migration no cloud:

Run (DATABASE_URL do cloud, do bloco CLOUD do `.env`): `pnpm db:migrate`
Expected: "migrations applied successfully". Verifique a tabela e a coluna no cloud.

Run: `railway up --service igni-app --ci`
Expected: "Deploy complete".

- [ ] **Step 6: Smoke test (curl, sem Playwright)**

Verifique em prod:
- `/quiosque/token-invalido` → 200 com "Quiosque desligado" (não vaza, não 500).
- `/quiosque/entrar` → 200 (tela de código).
- `/login` → 200; `/config/estacoes` → 307 → /login (protegida).

```bash
# via HttpWebRequest/Invoke-WebRequest sem seguir redirect; confirmar status
```

- [ ] **Step 7: Atualizar docs**

Modify `docs/00_status.md` e `docs/15_backlog_produto.md` (marcar P-0 como no ar). Modify o spec com as 2 notas de design registradas (código curto aceito na resolução; gate de orçamento simplificado). Commit + push.

```bash
git add docs/
git commit -m "docs: P-0 (quiosque de setor + PIN) no ar"
git push origin main
```

---

## Self-Review

**1. Spec coverage:**
- Duas credenciais (token forte + PIN carimbo) → Tasks 1–4. ✅
- Schema `usuario.pin_hash` + `quiosque_setor` + RLS → Task 1. ✅
- Resolução em 2 etapas → Task 4 (`resolverQuiosque`). ✅
- PIN carimbo, não destranca → Task 4 (`bumpPorQuiosque`: PIN errado retorna motivo, não muda estado). ✅
- Escopo do setor + travar/destravar → Task 4 (checa `estacaoId`) + Task 7 (UI). ⚠️ **Travar/destravar pelo quiosque**: o spec inclui; adicionar `travarPorQuiosque`/`destravarPorQuiosque` análogos ao bump (mesma resolução de token + PIN) — **adicionado como nota; se o piloto não pedir de imediato, cortar desta leva** (YAGNI). Registrado como opcional na Task 4/7.
- QR + código curto → Task 6 (QR) + Task 7 (entrada por código). ✅
- Admin define PIN / revoga na tela de Estações → Task 6. ✅
- Rate-limit → Task 7 (view + código). ✅
- Isolamento multi-tenant testado → Tasks 1, 3, 4, 8. ✅
- Middleware libera `/quiosque` → Task 7. ✅

**2. Placeholder scan:** O Step 2 da Task 4 continha um placeholder proibido (`execute?.(undefined as never)`) — está **marcado com correção explícita** logo abaixo (reescrever o `beforeEach` no padrão dos outros testes). O implementador deve escrever o `beforeEach` real ali, sem o placeholder. Todos os demais steps têm código concreto.

**3. Type consistency:** `resolverQuiosque` retorna `{ tenantId, estacaoId, quiosqueId }` em todas as chamadas (Tasks 4, 5). `QuiosqueView`/`CardQuiosque`/`DadosQuiosque` definidos uma vez e reusados. `hash()` é a mesma helper (sha256 hex) em toda a aplicação. `bumpPorQuiosque` e `bumpQuiosquePublico` têm assinaturas consistentes.

**Escopo desta leva (DECIDIDO com o dono, 02/07):** travar/destravar pelo quiosque **fica FORA** desta leva (YAGNI — menor valor, maior superfície). Entregar **bump + detalhe básico** (Tasks 1–8). Adicionar travar/destravar numa fatia curta seguinte SÓ se o piloto pedir. Onde as tasks mencionam `travarPorQuiosque`/`destravarPorQuiosque`, **não implementar** — o quiosque nesta leva só avança OS e mostra o card. O card pode exibir o selo "travado" (leitura), mas não há ação de travar pelo tablet.
