# Registrar pagamento / baixa (P-4b) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O financeiro registra que recebeu (baixa total): a conta a receber vira `recebida` com a forma de pagamento e a data; e pode desfazer a baixa (`recebida`→`aberta`) se registrou por engano — tudo no bloco Financeiro do detalhe da OS.

**Architecture:** A `conta_receber` (P-4a) ganha duas colunas (`forma_pagamento`, `recebido_em`) — sem tabela nova, pois a baixa é total. O domínio ganha `recebida→aberta` (permite desfazer) + `FORMAS_PAGAMENTO`/`validarBaixa`. Aplicação: `registrarRecebimento`/`desfazerRecebimento`. Bloco Financeiro ganha os botões. O `aprovarOrcamento` (P-4a) NÃO muda.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Drizzle ORM + Postgres (Supabase), RLS multi-tenant via `withTenant`, Tailwind v4, Vitest.

## Global Constraints

- **TypeScript strict, zero `any`.** Lint estrito (boundary guard: `src/app` NUNCA importa `@/infra/db/client`).
- **Dinheiro SEMPRE em centavos inteiros.**
- **Migrations só via Drizzle** (`drizzle-kit generate` gera o SQL — aqui é `CREATE TYPE forma_pagamento` novo + `ADD COLUMN` x2; NÃO é `ALTER TYPE ADD VALUE`, sem o cuidado de transação). Migration cloud: `railway run --service igni-app pnpm db:migrate` (`DATABASE_URL` do cloud nos secrets do Railway; `.env` local aponta para `127.0.0.1:5442x`).
- **Isolamento multi-tenant**: esta fatia **NÃO cria tabela nova** — a `conta_receber` já tem RLS testada A↔B (P-4a). NÃO precisa de novo teste de isolamento; só testes da máquina/aplicação (o teste de isolamento existente em `conta.test.ts` deve continuar passando).
- **SEM Playwright.** Verificação por typecheck/lint/build/test + curl.
- **CI verde antes do deploy.** Deploy: `railway up --service igni-app --ci`. Commit/push junto (o `git push` mostra um stderr no PowerShell que é SUCESSO — usar Bash).
- **Commits Conventional**; a mensagem termina com: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Baixa TOTAL** (recebeu tudo de uma vez) — sem tabela de pagamentos, sem parcial.
- **NÃO TOCAR `aprovarOrcamento`** (`application/orcamento.ts`): o congelamento automático de conta `recebida` permanece. Só o `desfazerRecebimento` manual reabre. A regressão prova isso.
- **RBAC**: nada muda no catálogo. `financeiro:gerir` (já existe, P-4a) para registrar/desfazer/cancelar; `dinheiro:ver` para ver o bloco.
- **Formas de pagamento (exatas):** `dinheiro`, `pix`, `cartao_debito`, `cartao_credito`, `transferencia`, `boleto`.

---

## Estrutura de arquivos

**Modificados:**
- `src/infra/db/schema/enums.ts` — `formaPagamento` pgEnum.
- `src/infra/db/schema/conta-receber.ts` — colunas `formaPagamento`/`recebidoEm`.
- `src/infra/db/migrations/00XX_*.sql` — enum + colunas (gerado).
- `src/domain/financeiro/conta.ts` — `TRANSICOES.recebida += aberta`; `FORMAS_PAGAMENTO`/`FormaPagamento`/`validarBaixa`/`ROTULO_FORMA_PAGAMENTO`.
- `src/domain/financeiro/__tests__/conta.test.ts` — recebida→aberta agora válida; drift do novo enum.
- `src/application/conta.ts` — `registrarRecebimento`, `desfazerRecebimento`; `ContaView` cresce; `contaDaOs` seleciona os campos.
- `src/application/__tests__/conta.test.ts` — casos da máquina (registrar/desfazer).
- `src/infra/composition/conta.ts` — `registrarRecebimentoNoTenant`, `desfazerRecebimentoNoTenant`.
- `src/app/os/[id]/financeiro.tsx` — botões registrar/desfazer + seletor de forma.
- `src/app/os/[id]/page.tsx` — renomear o prop `podeCancelar`→`podeGerir`.
- `src/app/os/actions.ts` — `acaoRegistrarRecebimento`, `acaoDesfazerRecebimento`.

---

## Task 1: Schema (enum + 2 colunas) + domínio (transição + formas)

**Files:**
- Modify: `src/infra/db/schema/enums.ts`, `src/infra/db/schema/conta-receber.ts`
- Create (gerado): `src/infra/db/migrations/00XX_*.sql`
- Modify: `src/domain/financeiro/conta.ts`, `src/domain/financeiro/__tests__/conta.test.ts`

**Interfaces:**
- Produces: enum `formaPagamento`; colunas `contaReceber.formaPagamento`/`recebidoEm`; `FORMAS_PAGAMENTO`/`type FormaPagamento`/`validarBaixa(forma)`/`ROTULO_FORMA_PAGAMENTO` de `@/domain/financeiro/conta`; `TRANSICOES.recebida = ["aberta"]`.

- [ ] **Step 1: enum `forma_pagamento`**

Em `src/infra/db/schema/enums.ts`, adicionar (junto dos outros pgEnum):
```typescript
/** Forma de pagamento na baixa (P-4b): como a oficina recebeu. Espelha `FORMAS_PAGAMENTO` do domínio (drift). */
export const formaPagamento = pgEnum("forma_pagamento", ["dinheiro", "pix", "cartao_debito", "cartao_credito", "transferencia", "boleto"]);
```

- [ ] **Step 2: colunas na `conta_receber`**

Em `src/infra/db/schema/conta-receber.ts`: adicionar o import do enum e as duas colunas (após `status`, antes de `createdAt`):
```typescript
import { formaPagamento } from "./enums";
```
```typescript
    formaPagamento: formaPagamento("forma_pagamento"),
    recebidoEm: timestamp("recebido_em", { withTimezone: true }),
```
(ambas nullable — sem `.notNull()`. `timestamp` já é importado no arquivo.)

- [ ] **Step 3: gerar a migration**

Confira o maior número em `src/infra/db/migrations/` (hoje 0034). Run: `pnpm drizzle-kit generate`
Expected: cria `00XX` (0035) com `CREATE TYPE "forma_pagamento"` + `ALTER TABLE "conta_receber" ADD COLUMN "forma_pagamento" ...` + `ADD COLUMN "recebido_em" timestamp with time zone`. Não há migration manual aqui (é enum novo + colunas, o drizzle registra sozinho no journal).
Run: `pnpm db:migrate` (banco local) → aplica sem erro.

- [ ] **Step 4: atualizar os testes do domínio (a transição mudou)**

Em `src/domain/financeiro/__tests__/conta.test.ts`, substituir o caso "recebida é terminal" e adicionar os novos. O import cresce:
```typescript
import { FORMAS_PAGAMENTO, STATUS_CONTA, validarBaixa, validarTransicaoConta } from "@/domain/financeiro/conta";
import { formaPagamento, statusConta } from "@/infra/db/schema/enums";
```
Substituir o bloco `it("recebida é terminal…")` por:
```typescript
  it("recebida → aberta é válida (desfazer); recebida → cancelada NÃO", () => {
    expect(() => validarTransicaoConta("recebida", "aberta")).not.toThrow();
    expect(() => validarTransicaoConta("recebida", "cancelada")).toThrow(DadosInvalidosError);
  });
```
Adicionar, no fim do describe:
```typescript
  it("o enum forma_pagamento do banco espelha FORMAS_PAGAMENTO (drift)", () => {
    expect([...FORMAS_PAGAMENTO].sort()).toEqual([...formaPagamento.enumValues].sort());
  });

  it("validarBaixa aceita forma do enum e rejeita fora dele", () => {
    expect(() => validarBaixa("pix")).not.toThrow();
    expect(() => validarBaixa("bitcoin")).toThrow(DadosInvalidosError);
  });
```
(O caso "rejeita transições sem sentido" com `aberta→aberta` e `cancelada→recebida` permanece — ambos ainda rejeitam.)

- [ ] **Step 5: rodar o teste (RED)**

Run: `pnpm test src/domain/financeiro/__tests__/conta.test.ts`
Expected: FAIL (`validarBaixa`/`FORMAS_PAGAMENTO` não existem; `recebida→aberta` ainda lança).

- [ ] **Step 6: implementar o domínio**

Em `src/domain/financeiro/conta.ts`: mudar `TRANSICOES.recebida` e adicionar formas. Novo conteúdo:
```typescript
import { DadosInvalidosError } from "@/domain/shared/errors";

/** Status da conta a receber (P-4a). Espelha o enum `status_conta` do banco (teste de drift). */
export const STATUS_CONTA = ["aberta", "recebida", "cancelada"] as const;
export type StatusConta = (typeof STATUS_CONTA)[number];

/**
 * Transições permitidas do dinheiro. `recebida→aberta` existe para o DESFAZER manual (P-4b) — mas o
 * congelamento automático (aprovarOrcamento não toca conta recebida) permanece; só a ação explícita reabre.
 */
const TRANSICOES: Record<StatusConta, readonly StatusConta[]> = {
  aberta: ["recebida", "cancelada"],
  cancelada: ["aberta"],
  recebida: ["aberta"],
};

/** Valida uma transição de status da conta. Lança DadosInvalidosError se inválida. */
export function validarTransicaoConta(de: StatusConta, para: StatusConta): void {
  if (!TRANSICOES[de].includes(para)) {
    throw new DadosInvalidosError(`Transição de conta inválida: ${de} → ${para}.`);
  }
}

/** Formas de pagamento aceitas na baixa (P-4b). Espelha o enum `forma_pagamento` do banco (drift). */
export const FORMAS_PAGAMENTO = ["dinheiro", "pix", "cartao_debito", "cartao_credito", "transferencia", "boleto"] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const ROTULO_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_debito: "Cartão de débito",
  cartao_credito: "Cartão de crédito",
  transferencia: "Transferência",
  boleto: "Boleto",
};

/** Valida a forma de pagamento da baixa. Lança DadosInvalidosError se não for do catálogo. */
export function validarBaixa(forma: string): void {
  if (!(FORMAS_PAGAMENTO as readonly string[]).includes(forma)) {
    throw new DadosInvalidosError("Forma de pagamento inválida.");
  }
}
```

- [ ] **Step 7: rodar o teste (verde)**

Run: `pnpm test src/domain/financeiro/__tests__/conta.test.ts`
Expected: todos PASS.

- [ ] **Step 8: typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: verdes.

- [ ] **Step 9: Commit**

```bash
git add src/infra/db/schema/enums.ts src/infra/db/schema/conta-receber.ts src/infra/db/migrations/ src/domain/financeiro/conta.ts src/domain/financeiro/__tests__/conta.test.ts
git commit -m "feat(financeiro): forma_pagamento + recebido_em na conta + recebida→aberta (P-4b fatia 1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Aplicação — registrarRecebimento + desfazerRecebimento

**Files:**
- Modify: `src/application/conta.ts`
- Modify: `src/application/__tests__/conta.test.ts`
- Modify: `src/infra/composition/conta.ts`

**Interfaces:**
- Consumes: `validarBaixa`, `validarTransicaoConta`, `type FormaPagamento`, `type StatusConta` de `@/domain/financeiro/conta`; `contaReceber` do schema.
- Produces:
  - `ContaView = { id; status: StatusConta; valorCentavos: number; formaPagamento: FormaPagamento | null; recebidoEm: Date | null }`.
  - `registrarRecebimento(database, sessao, contaId, forma: string): Promise<void>`.
  - `desfazerRecebimento(database, sessao, contaId): Promise<void>`.
  - Composição: `registrarRecebimentoNoTenant(sessao, contaId, forma)`, `desfazerRecebimentoNoTenant(sessao, contaId)`.

- [ ] **Step 1: escrever os testes de aplicação (RED)**

Em `src/application/__tests__/conta.test.ts`, ajustar o import e adicionar casos. O import:
```typescript
import { cancelarConta, contaDaOs, desfazerRecebimento, registrarRecebimento } from "@/application/conta";
```
Adicionar (dentro do describe, usando o mesmo setup que cria conta via aprovar — ver os casos existentes que já obtêm `conta`):
```typescript
  it("registrarRecebimento marca recebida com forma e data (só de aberta)", async () => {
    // (obter a conta aberta como os testes existentes: aprovar o orçamento)
    const conta = await contaDaOs(database, sessaoA, osId);
    await registrarRecebimento(database, sessaoA, conta!.id, "pix");
    const depois = await contaDaOs(database, sessaoA, osId);
    expect(depois!.status).toBe("recebida");
    expect(depois!.formaPagamento).toBe("pix");
    expect(depois!.recebidoEm).not.toBeNull();
  });

  it("registrarRecebimento rejeita forma inválida", async () => {
    const conta = await contaDaOs(database, sessaoA, osId);
    await expect(registrarRecebimento(database, sessaoA, conta!.id, "bitcoin")).rejects.toThrow(DadosInvalidosError);
  });

  it("registrarRecebimento rejeita conta já recebida (só de aberta)", async () => {
    const conta = await contaDaOs(database, sessaoA, osId);
    await registrarRecebimento(database, sessaoA, conta!.id, "dinheiro");
    await expect(registrarRecebimento(database, sessaoA, conta!.id, "pix")).rejects.toThrow(DadosInvalidosError);
  });

  it("desfazerRecebimento volta a aberta e limpa forma/data (só de recebida)", async () => {
    const conta = await contaDaOs(database, sessaoA, osId);
    await registrarRecebimento(database, sessaoA, conta!.id, "dinheiro");
    await desfazerRecebimento(database, sessaoA, conta!.id);
    const depois = await contaDaOs(database, sessaoA, osId);
    expect(depois!.status).toBe("aberta");
    expect(depois!.formaPagamento).toBeNull();
    expect(depois!.recebidoEm).toBeNull();
  });

  it("desfazerRecebimento rejeita conta aberta (só de recebida)", async () => {
    const conta = await contaDaOs(database, sessaoA, osId);
    await expect(desfazerRecebimento(database, sessaoA, conta!.id)).rejects.toThrow(DadosInvalidosError);
  });
```
> Nota: use exatamente o mesmo padrão de setup dos casos já presentes no arquivo (eles obtêm `osId`/`conta` aprovando o orçamento). Não invente um setup novo — copie o dos vizinhos. O caso EXISTENTE "conta recebida NÃO é tocada ao reaprovar" (a regressão do congelamento) PERMANECE — não removê-lo; ele prova que o `aprovarOrcamento` não muda.

- [ ] **Step 2: rodar (RED)**

Run: `pnpm test src/application/__tests__/conta.test.ts`
Expected: FAIL (`registrarRecebimento`/`desfazerRecebimento` não existem; `ContaView` sem os campos).

- [ ] **Step 3: `ContaView` cresce + `contaDaOs` seleciona + as 2 funções**

Em `src/application/conta.ts`: o import do domínio cresce; `ContaView` ganha os campos; `contaDaOs` seleciona; adicionar `registrarRecebimento`/`desfazerRecebimento`. Trechos:
```typescript
import { type FormaPagamento, type StatusConta, validarBaixa, validarTransicaoConta } from "@/domain/financeiro/conta";
```
```typescript
export interface ContaView {
  id: string;
  status: StatusConta;
  valorCentavos: number;
  formaPagamento: FormaPagamento | null;
  recebidoEm: Date | null;
}
```
No `contaDaOs`, o `select` passa a incluir os campos:
```typescript
    const [c] = await tx
      .select({
        id: contaReceber.id,
        status: contaReceber.status,
        valorCentavos: contaReceber.valorCentavos,
        formaPagamento: contaReceber.formaPagamento,
        recebidoEm: contaReceber.recebidoEm,
      })
      .from(contaReceber)
      .where(eq(contaReceber.osId, osId))
      .limit(1);
    return c ?? null;
```
Adicionar as funções (molde do `cancelarConta`):
```typescript
/** Registra a baixa (aberta → recebida) com a forma e a data (=agora). Gate financeiro:gerir na action. */
export function registrarRecebimento(
  database: Database,
  sessao: SessaoTenant,
  contaId: string,
  forma: string,
): Promise<void> {
  validarBaixa(forma);
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [c] = await tx.select({ status: contaReceber.status }).from(contaReceber).where(eq(contaReceber.id, contaId)).limit(1);
    if (!c) {
      throw new DadosInvalidosError("Conta não encontrada.");
    }
    validarTransicaoConta(c.status, "recebida");
    await tx
      .update(contaReceber)
      .set({ status: "recebida", formaPagamento: forma as FormaPagamento, recebidoEm: new Date() })
      .where(eq(contaReceber.id, contaId));
  });
}

/** Desfaz a baixa (recebida → aberta): limpa forma e data. Só de recebida. Gate financeiro:gerir na action. */
export function desfazerRecebimento(database: Database, sessao: SessaoTenant, contaId: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [c] = await tx.select({ status: contaReceber.status }).from(contaReceber).where(eq(contaReceber.id, contaId)).limit(1);
    if (!c) {
      throw new DadosInvalidosError("Conta não encontrada.");
    }
    validarTransicaoConta(c.status, "aberta");
    await tx
      .update(contaReceber)
      .set({ status: "aberta", formaPagamento: null, recebidoEm: null })
      .where(eq(contaReceber.id, contaId));
  });
}
```
> `validarBaixa(forma)` roda ANTES do `withTenant` (throw → rejeição de Promise, contrato uniforme). O `forma as FormaPagamento` é seguro porque `validarBaixa` já garantiu que está no enum.

- [ ] **Step 4: rodar (verde) + regressão**

Run: `pnpm test src/application/__tests__/conta.test.ts`
Expected: os novos passam E os existentes (incl. "conta recebida NÃO é tocada ao reaprovar") continuam passando.

- [ ] **Step 5: composição**

Em `src/infra/composition/conta.ts`, adicionar os wrappers + o import:
```typescript
import { cancelarConta, contaDaOs, type ContaView, desfazerRecebimento, registrarRecebimento } from "@/application/conta";
```
```typescript
export function registrarRecebimentoNoTenant(sessao: SessaoTenant, contaId: string, forma: string): Promise<void> {
  return registrarRecebimento(database, sessao, contaId, forma);
}
export function desfazerRecebimentoNoTenant(sessao: SessaoTenant, contaId: string): Promise<void> {
  return desfazerRecebimento(database, sessao, contaId);
}
```

- [ ] **Step 6: typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: verdes.

- [ ] **Step 7: Commit**

```bash
git add src/application/conta.ts src/application/__tests__/conta.test.ts src/infra/composition/conta.ts
git commit -m "feat(financeiro): registrarRecebimento + desfazerRecebimento + ContaView com forma/data (P-4b fatia 2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Bloco Financeiro — registrar/desfazer recebimento

**Files:**
- Modify: `src/app/os/[id]/financeiro.tsx`
- Modify: `src/app/os/[id]/page.tsx`
- Modify: `src/app/os/actions.ts`

**Interfaces:**
- Consumes: `registrarRecebimentoNoTenant`, `desfazerRecebimentoNoTenant`, `type ContaView` de `@/infra/composition/conta`; `FORMAS_PAGAMENTO`, `ROTULO_FORMA_PAGAMENTO` de `@/domain/financeiro/conta`; `moeda`, `data` de `@/ui/format`; `pode` de `@/domain/auth/rbac`.
- Produces: `acaoRegistrarRecebimento(contaId, osId, forma)`, `acaoDesfazerRecebimento(contaId, osId)`.

- [ ] **Step 1: actions**

Em `src/app/os/actions.ts` (onde vive `acaoCancelarCobranca` — reuse o helper `autorizar("financeiro:gerir")` e `revalidarOs` já existentes; ver o `acaoCancelarCobranca` como molde). Adicionar:
```typescript
export async function acaoRegistrarRecebimento(contaId: string, osId: string, forma: string): Promise<{ ok: boolean; motivo?: string }> {
  const auth = await autorizar("financeiro:gerir");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await registrarRecebimentoNoTenant(auth.sessao, contaId, forma);
    revalidarOs(osId);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível registrar o recebimento." };
  }
}

export async function acaoDesfazerRecebimento(contaId: string, osId: string): Promise<{ ok: boolean; motivo?: string }> {
  const auth = await autorizar("financeiro:gerir");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await desfazerRecebimentoNoTenant(auth.sessao, contaId);
    revalidarOs(osId);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível desfazer o recebimento." };
  }
}
```
> Confirme os nomes reais do helper de autorização e do retorno no `actions.ts` (o `acaoCancelarCobranca` mostra o padrão exato — se ele usa `{sessao}` direto em vez de `autorizar()`, siga o mesmo estilo). Importar `registrarRecebimentoNoTenant`/`desfazerRecebimentoNoTenant` de `@/infra/composition/conta`.

- [ ] **Step 2: renomear o prop na page**

Em `src/app/os/[id]/page.tsx`, o `<Financeiro>` recebe `podeCancelar={podeCancelarCobranca}`. Renomear o prop para `podeGerir` (o gate é o mesmo `financeiro:gerir` para cancelar/registrar/desfazer):
```tsx
<Financeiro conta={conta} osId={os.id} podeGerir={podeCancelarCobranca} />
```
(A variável `podeCancelarCobranca` na page pode manter o nome ou virar `podeGerirFinanceiro` — decisão do implementer; o importante é o prop do componente chamar `podeGerir`.)

- [ ] **Step 3: o bloco Financeiro com as ações**

Reescrever `src/app/os/[id]/financeiro.tsx` para: prop `podeGerir`; quando `aberta` → "Registrar recebimento" (abre `<select>` de forma) + "Cancelar cobrança"; quando `recebida` → "recebido por {forma} em {data}" + "Desfazer recebimento" (confirmação inline); quando `cancelada` → sem ações.
```typescript
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FORMAS_PAGAMENTO, ROTULO_FORMA_PAGAMENTO } from "@/domain/financeiro/conta";
import type { ContaView } from "@/infra/composition/conta";
import { data, moeda } from "@/ui/format";
import { acaoCancelarCobranca, acaoDesfazerRecebimento, acaoRegistrarRecebimento } from "../actions";

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
 * Bloco Financeiro do detalhe da OS (P-4a/P-4b): mostra a conta e permite registrar o recebimento
 * (baixa total, com forma + data), desfazer um recebimento, ou cancelar a cobrança. Tudo gated por
 * financeiro:gerir (`podeGerir`). Ver o bloco já é gated por dinheiro:ver (na page).
 */
export function Financeiro({ conta, osId, podeGerir }: { conta: ContaView; osId: string; podeGerir: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [forma, setForma] = useState<string>(FORMAS_PAGAMENTO[0]);
  const [confirmandoDesfazer, setConfirmandoDesfazer] = useState(false);

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

  return (
    <section aria-label="Financeiro" className="rounded-lg border border-grafite-700 bg-grafite-850 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-aco-400">Financeiro</p>
          <p className="mt-1 font-display text-xl text-aco-100">
            {moeda(conta.valorCentavos)}{" "}
            <span className={`font-body text-sm ${COR[conta.status]}`}>· {ROTULO[conta.status]}</span>
          </p>
          {conta.status === "recebida" && conta.formaPagamento ? (
            <p className="mt-0.5 font-body text-xs text-aco-400">
              recebido por {ROTULO_FORMA_PAGAMENTO[conta.formaPagamento]}
              {conta.recebidoEm ? ` em ${data(conta.recebidoEm)}` : ""}
            </p>
          ) : null}
        </div>

        {podeGerir ? (
          <div className="flex flex-wrap items-center gap-2">
            {conta.status === "aberta" && !registrando ? (
              <>
                <button
                  type="button"
                  onClick={() => setRegistrando(true)}
                  disabled={pendente}
                  className="rounded-md bg-ambar-500 px-3 py-1.5 font-body text-sm font-medium text-grafite-950 hover:bg-ambar-400 disabled:opacity-50"
                >
                  Registrar recebimento
                </button>
                <button
                  type="button"
                  onClick={() => rodar(() => acaoCancelarCobranca(conta.id, osId))}
                  disabled={pendente}
                  className="rounded-md border border-grafite-600 px-3 py-1.5 font-body text-sm text-aco-400 hover:border-sinal-vermelho hover:text-sinal-vermelho disabled:opacity-50"
                >
                  Cancelar cobrança
                </button>
              </>
            ) : null}

            {conta.status === "aberta" && registrando ? (
              <>
                <select
                  value={forma}
                  onChange={(e) => setForma(e.target.value)}
                  aria-label="Forma de pagamento"
                  disabled={pendente}
                  className="rounded-md border border-grafite-600 bg-grafite-900 px-2 py-1.5 font-body text-sm text-aco-100"
                >
                  {FORMAS_PAGAMENTO.map((f) => (
                    <option key={f} value={f}>{ROTULO_FORMA_PAGAMENTO[f]}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => rodar(() => acaoRegistrarRecebimento(conta.id, osId, forma))}
                  disabled={pendente}
                  className="rounded-md bg-sinal-verde px-3 py-1.5 font-body text-sm font-medium text-grafite-950 hover:opacity-90 disabled:opacity-50"
                >
                  Confirmar recebimento
                </button>
                <button
                  type="button"
                  onClick={() => setRegistrando(false)}
                  disabled={pendente}
                  className="rounded-md px-2 py-1.5 font-body text-sm text-aco-400 hover:text-aco-100"
                >
                  Cancelar
                </button>
              </>
            ) : null}

            {conta.status === "recebida" ? (
              confirmandoDesfazer ? (
                <span className="flex items-center gap-2">
                  <span className="font-body text-sm text-aco-300">Desfazer?</span>
                  <button
                    type="button"
                    onClick={() => rodar(() => acaoDesfazerRecebimento(conta.id, osId))}
                    disabled={pendente}
                    className="rounded-md bg-sinal-vermelho px-2 py-1 font-mono text-xs text-grafite-950 disabled:opacity-50"
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoDesfazer(false)}
                    className="rounded-md px-2 py-1 font-mono text-xs text-aco-400 hover:text-aco-100"
                  >
                    Não
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmandoDesfazer(true)}
                  disabled={pendente}
                  className="rounded-md border border-grafite-600 px-3 py-1.5 font-body text-sm text-aco-400 hover:border-ambar-500 hover:text-ambar-500 disabled:opacity-50"
                >
                  Desfazer recebimento
                </button>
              )
            ) : null}
          </div>
        ) : null}
      </div>
      {erro ? <p role="alert" className="mt-2 font-body text-sm text-sinal-vermelho">{erro}</p> : null}
    </section>
  );
}
```
> Confirme os nomes de cor do Tailwind (`bg-sinal-verde`, `text-grafite-950`) contra os componentes vizinhos; ajuste se o token diferir (ex.: `grafite-900`). O padrão de confirmação inline (Sim/Não) espelha `confirmandoRemover` de `editor-estacoes.tsx`.

- [ ] **Step 4: typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: verdes. `pnpm test` — nada quebrou.

- [ ] **Step 5: Commit**

```bash
git add src/app/os/[id]/financeiro.tsx src/app/os/[id]/page.tsx src/app/os/actions.ts
git commit -m "feat(financeiro): registrar/desfazer recebimento no bloco Financeiro da OS (P-4b fatia 3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Pipeline + deploy

**Files:** nenhum código novo; conduz o merge e o deploy. (Controlador.)

- [ ] **Step 1: Pipeline local** — `pnpm typecheck && pnpm lint && pnpm build && pnpm test`. Verde (Docker fora → confiar no CI para DB).
- [ ] **Step 2: Merge + push** — `git checkout main && git merge --no-ff feat/registrar-pagamento-p4b -m "feat(financeiro): registrar pagamento/baixa (P-4b)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" && git push origin main`.
- [ ] **Step 3: CI verde** — `gh run watch $(gh run list --branch main --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`.
- [ ] **Step 4: Migration cloud** — `railway run --service igni-app pnpm db:migrate`.
- [ ] **Step 5: Verificar no cloud** (script temporário na raiz, removido depois): as 2 colunas novas existem em `conta_receber` (`forma_pagamento`, `recebido_em`); o enum `forma_pagamento` tem os 6 valores. Rodar via `railway run --service igni-app node verify-p4b.mjs`. Remover.
- [ ] **Step 6: Deploy** — `railway up --service igni-app --ci`.
- [ ] **Step 7: Smoke** — `curl`: `/login` 200; `/os` 307→/login. (O bloco financeiro é interno ao detalhe da OS — o smoke confirma a app no ar.)
- [ ] **Step 8: Docs + branch + memória** — `docs/00_status.md` e `docs/15_backlog_produto.md` (P-4b no ar; P-4c segue); apagar branch; memória `registrar-pagamento-p4b.md` (baixa total, forma+data, desfazer, aprovarOrcamento intocado).

---

## Self-review (feito pelo autor do plano)

**1. Cobertura do spec:**
- Enum `forma_pagamento` + 2 colunas na `conta_receber` → Task 1. ✓
- Domínio: `TRANSICOES.recebida += aberta`, `FORMAS_PAGAMENTO`/`FormaPagamento`/`validarBaixa`/`ROTULO` + drift → Task 1. ✓
- Teste de domínio atualizado (recebida→aberta agora válida) → Task 1 Step 4. ✓
- `registrarRecebimento`/`desfazerRecebimento` + `ContaView` cresce + `contaDaOs` seleciona → Task 2. ✓
- Composição wrappers → Task 2 Step 5. ✓
- Regressão (aprovarOrcamento congela recebida) → Task 2 Step 4 (o caso existente permanece). ✓
- Bloco Financeiro (registrar com seletor + desfazer com confirmação inline + "recebido por X em DATA") → Task 3. ✓
- Actions gate financeiro:gerir → Task 3 Step 1. ✓
- `aprovarOrcamento` NÃO tocado → nenhuma task o modifica. ✓
- Deploy + verificar colunas/enum no cloud → Task 4. ✓
- Fora de escopo (parcial, P-4c, fiscal) → nenhuma task os inclui. ✓

**2. Placeholders:** sem placeholder. Os testes de aplicação (Task 2 Step 1) trazem uma nota explícita para reusar o setup dos casos vizinhos (obter `osId`/`conta` aprovando o orçamento) em vez de inventar — isso é instrução, não buraco; o código dos casos é completo. O número da migration (00XX) é o índice real do drizzle (Task 1 Step 3).

**3. Consistência de tipos:** `ContaView` com `formaPagamento`/`recebidoEm` definido na Task 2 e consumido na Task 3; `FormaPagamento`/`FORMAS_PAGAMENTO`/`ROTULO_FORMA_PAGAMENTO`/`validarBaixa` uniformes entre domínio (Task 1) e uso (Tasks 2-3); `registrarRecebimento(…, forma: string)` recebe string (do `<select>`) e valida no domínio; o prop `podeGerir` consistente entre page (Task 3 Step 2) e componente (Step 3). `data()` (não `dataHora`) confirmado no `@/ui/format`.

**4. Risco residual (para o revisor):** (a) o teste de domínio "recebida é terminal" MUDA de sentido (recebida→aberta agora válida) — o reviewer confirma que o teste foi atualizado corretamente e que `recebida→cancelada` ainda rejeita. (b) o `aprovarOrcamento` NÃO deve ser tocado — o reviewer confirma que a regressão do congelamento (caso existente em conta.test) passa e que nenhuma linha do orcamento.ts mudou. (c) o prop foi renomeado `podeCancelar`→`podeGerir` — o reviewer confirma que a page passa o novo nome e que nada mais consumia o antigo.
