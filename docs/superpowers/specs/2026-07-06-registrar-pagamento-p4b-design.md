# P-4b — Registrar pagamento / baixa (Módulo Financeiro, fatia 2)

> Design validado com o dono em 06/07/2026 (brainstorm). Backlog: `docs/15_backlog_produto.md` (P-4).
> App EM PRODUÇÃO (Next.js + Supabase + Drizzle + RLS por tenant). Schema-first, uma fatia por vez.

## O problema

Fechar o ciclo do dinheiro. A conta a receber (P-4a, no ar) nasce quando o orçamento é aprovado; a P-4b
registra que a oficina **RECEBEU** — dá a baixa (`aberta`→`recebida`), com a forma de pagamento e a data.

## Fronteira (Canvas + dono, confirmada no P-4a)

**SEM gateway de pagamento** (sem link online/máquina de cartão integrada — Onda 3). A baixa é **manual**: o
financeiro registra que recebeu. A **forma de pagamento** é uma opção (dinheiro/pix/cartão…), sem integrar
máquina. **Baixa total** de uma vez (recebeu tudo) — pagamento parcial fica para uma fatia futura, se a dor
surgir.

## Fundação já pronta (P-4a, no ar)

- Tabela `conta_receber` (id, tenant_id, os_id, orcamento_id, valor_centavos, status enum `status_conta`
  [aberta|recebida|cancelada], created_at), RLS por tenant, unique(orcamento_id).
- Domínio `domain/financeiro/conta.ts`: `validarTransicaoConta(de,para)`; `aberta→recebida` **já é válida**.
- Aplicação `application/conta.ts`: `cancelarConta` (molde) + `contaDaOs` (leitura, `ContaView`).
- Bloco Financeiro `app/os/[id]/financeiro.tsx` mostra "R$ X · a receber/recebido/cancelado" + "Cancelar
  cobrança". RBAC: `dinheiro:ver` pra ver; `financeiro:gerir` pra agir (Dono/Gestor/Financeiro; recepção não).

---

## Arquitetura (P-4b): campos na conta (sem tabela nova)

Como a baixa é total, a P-4b **adiciona colunas à `conta_receber`** — não precisa de tabela de pagamentos.

### `conta_receber` ganha duas colunas

| Coluna | Tipo | Nota |
|---|---|---|
| `forma_pagamento` | enum `forma_pagamento` (`dinheiro` \| `pix` \| `cartao_debito` \| `cartao_credito` \| `transferencia` \| `boleto`), **nullable** | como recebeu; nulo enquanto `aberta`/`cancelada` |
| `recebido_em` | timestamptz **nullable** | quando recebeu (= `now` na baixa); nulo enquanto não recebida |

Ambas nulas por padrão; preenchidas na baixa, **limpas no desfazer**. Novo enum `forma_pagamento` em
`schema/enums.ts`, espelhado no domínio com teste de drift (padrão de `status_conta`/`modo_tela`). Migration:
`CREATE TYPE forma_pagamento` + `ADD COLUMN` (não altera enum existente — sem o cuidado de `ALTER TYPE ADD VALUE`).

### Domínio cresce (aditivo)

- `TRANSICOES` (em `conta.ts`): `recebida` passa de `[]` (terminal) para `["aberta"]` — permite o **desfazer**.
  `validarTransicaoConta` continua o guardião. As transições agora: `aberta`→`recebida`/`cancelada`;
  `cancelada`→`aberta`; `recebida`→`aberta`.
- `FORMAS_PAGAMENTO` (readonly tuple) + `type FormaPagamento`; `validarBaixa(forma)` — a forma tem que ser do
  enum (lança `DadosInvalidosError` senão). `ROTULO_FORMA_PAGAMENTO` (pt-BR: "Dinheiro", "Pix", "Cartão de
  débito", "Cartão de crédito", "Transferência", "Boleto") — para a UI.

### Aplicação — duas funções novas (moldadas no `cancelarConta`)

- `registrarRecebimento(database, sessao, contaId, forma)`: valida `validarBaixa(forma)`; busca a conta;
  `validarTransicaoConta(status, "recebida")` (só de `aberta`); seta `status='recebida'`, `forma_pagamento=forma`,
  `recebido_em=now`.
- `desfazerRecebimento(database, sessao, contaId)`: busca a conta; `validarTransicaoConta(status, "aberta")`
  (só de `recebida`); seta `status='aberta'`, `forma_pagamento=null`, `recebido_em=null`.

`ContaView` cresce: ganha `formaPagamento: FormaPagamento | null` e `recebidoEm: Date | null`. `contaDaOs`
passa a selecioná-los.

### O `aprovarOrcamento` (P-4a) NÃO muda — ATENÇÃO

**Não tocar no `aprovarOrcamento` (`application/orcamento.ts`).** Ele tem hoje 4 ramos para a conta: sem
conta→cria; `aberta`→atualiza valor; `cancelada`→reabre (update direto); `recebida`→**não toca (congela)**.
Agora que `recebida→aberta` vira uma transição VÁLIDA no domínio (por causa do desfazer manual), é tentador
fazer o `aprovarOrcamento` reabrir conta recebida também — **NÃO fazer isso.** O congelamento automático
permanece: reaprovar o orçamento continua **não tocando** conta `recebida`. Só a ação explícita **"Desfazer
recebimento"** (do financeiro, gate `financeiro:gerir`) reabre. Separa o automático (nunca mexe no recebido)
da correção manual consciente — a auditoria honesta do P-4a fica intacta. A regressão testa isso.

## Superfícies e telas

O bloco Financeiro (`app/os/[id]/financeiro.tsx`) ganha as ações da baixa — gate `financeiro:gerir` em tudo:

- **Conta `aberta`**: **"Registrar recebimento"** → seletor inline de **forma de pagamento** (as 6 opções com
  rótulos) + "Confirmar recebimento" → vira `recebida` (forma + data=agora). O **"Cancelar cobrança"** continua.
- **Conta `recebida`**: mostra **"R$ X · recebido por Pix em 06/07/2026"** (forma + data via `data()`/`dataHora()`
  de `@/ui/format`) + **"Desfazer recebimento"** com **confirmação inline** ("Desfazer? Sim/Não"). Volta a `aberta`,
  limpa forma/data.
- **Conta `cancelada`**: só "cancelado", sem ações.

O seletor de forma é o único elemento novo: um `<select>` inline (sem modal — escolha rápida), seguindo o
padrão de `useTransition` + erro do bloco atual.

**Actions** (`app/os/actions.ts`, onde já vive `acaoCancelarCobranca`): `acaoRegistrarRecebimento(contaId, osId,
forma)` e `acaoDesfazerRecebimento(contaId, osId)` — gate `financeiro:gerir` no boundary, `revalidatePath` da OS,
`DadosInvalidosError` → mensagem amigável.

## RBAC (nada muda no catálogo)

- Ver o bloco: `dinheiro:ver`. Registrar/desfazer/cancelar: `financeiro:gerir` (já existe do P-4a). Nenhuma
  permissão nova; nenhuma migração de cargos.

## Invariantes (domínio, testados)

- `validarTransicaoConta` com o novo `recebida→aberta` válido; as inválidas seguem rejeitando (ex.:
  `recebida→cancelada`; `aberta→aberta`).
- `validarBaixa` rejeita forma fora do enum.
- Baixa preenche forma+data; desfazer limpa ambas.
- Isolamento por tenant: a `conta_receber` já tem RLS testada A↔B (P-4a); esta fatia não cria tabela.

## Fatiamento (schema-first, cada fatia testável e deployável)

1. **Schema + domínio** — enum `forma_pagamento`, colunas `forma_pagamento`/`recebido_em` (migration).
   Domínio: `TRANSICOES` += `recebida→aberta`; `FORMAS_PAGAMENTO`/`type FormaPagamento`/`validarBaixa`/
   `ROTULO_FORMA_PAGAMENTO`; drift dos dois enums (status_conta já existe; forma_pagamento novo).
2. **Aplicação + composição** — `registrarRecebimento`, `desfazerRecebimento`; `ContaView` += formaPagamento/
   recebidoEm; `contaDaOs` seleciona os campos; wrappers `*NoTenant`. Testes dos casos da máquina.
3. **Bloco Financeiro** — "Registrar recebimento" (seletor de forma) + "Desfazer recebimento" (confirmação
   inline) + exibe "recebido por X em DATA". Actions com gate `financeiro:gerir`.
4. **Pipeline + deploy** — CI, migration cloud via `railway run`, `railway up`, smoke.

## Fora de escopo (futuro)

- **Pagamento parcial** (tabela de pagamentos + saldo "quanto falta") — só se a oficina realmente parcelar.
- **P-4c**: relatório financeiro (quanto entrou no período — usa `recebido_em` + `forma_pagamento` desta fatia).
- Nota fiscal / gateway / link de pagamento (Onda 3). Juros/multa/desconto. Comprovante/anexo.

## Testes (Definition of Done)

- **Unidade**: `validarTransicaoConta` (recebida→aberta agora válida; recebida→cancelada e aberta→aberta
  rejeitam); `validarBaixa` (forma válida/ inválida); drift `forma_pagamento` × `FORMAS_PAGAMENTO`.
- **Integração**: `registrarRecebimento` seta status=recebida + forma + recebido_em (só de aberta; de recebida
  rejeita); `desfazerRecebimento` volta a aberta + limpa forma/data (só de recebida); `contaDaOs` traz os campos.
- **Regressão**: `aprovarOrcamento` continua congelando conta recebida (não muda — o P-4a segue intacto).
