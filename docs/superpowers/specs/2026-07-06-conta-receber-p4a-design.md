# P-4a — Conta a receber por OS (Módulo Financeiro, fatia 1)

> Design validado com o dono em 05-06/07/2026 (brainstorm, pausado e retomado). Backlog: `docs/15_backlog_produto.md` (P-4).
> App EM PRODUÇÃO (Next.js + Supabase + Drizzle + RLS por tenant). Schema-first, uma fatia por vez.

## O problema (a dor do dono)

O Igni não tem financeiro. É o motivo real de a **gestão** (não o chão) precisar de login. O Canvas
(`01_conception.md`) já previa "financeiro por OS" na Onda 2. A oportunidade: contas a receber por OS,
fluxo do orçamento aprovado → cobrança, relatório financeiro.

## Fronteira do P-4 (confirmada pelo dono + Canvas)

**Sem nota fiscal e sem gateway de pagamento** — o Canvas é explícito: *"fiscal/financeiro completos só por
integração"*, *"pagamento entra via integração/parceiro"* (Onda 3). Na reunião de teste (05/07) o dono
reconfirmou: nota fiscal via API "quando ficar caro, paga por ano" = futuro. O P-4 faz o **financeiro por
OS interno** (a receber + baixa + relatório), com a **porta aberta** para a integração fiscal depois.

## Decomposição do P-4

- **P-4a (ESTA fatia)**: **conta a receber** — nasce no orçamento aprovado, com o total; tem status próprio;
  acompanha o orçamento enquanto aberta, congela se recebida; pode ser cancelada. Mostra no detalhe da OS.
- **P-4b (futura)**: **registro de pagamento (baixa)** — `aberta` → `recebida` (o domínio da P-4a já modela
  a transição; a P-4b só pluga a UI + forma/data de pagamento).
- **P-4c (futura)**: **relatório financeiro** — quanto entrou no período, o que está em aberto, atraso.

---

## Arquitetura (P-4a)

O dinheiro tem uma **linha do tempo própria**, independente do estado físico da OS (que segue
`entrada→entrega`). Uma OS pode estar `entregue` e ainda `a receber` — e é isso que o dono quer VER.

### Tabela nova `conta_receber` (por tenant, RLS — regra de ouro #7)

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL → tenant (cascade) | RLS |
| `os_id` | uuid NOT NULL → os (cascade) | a OS que gerou |
| `orcamento_id` | uuid NOT NULL → orcamento (cascade) | de onde veio o valor |
| `valor_centavos` | integer NOT NULL | total aprovado (centavos, como todo dinheiro do Igni) |
| `status` | enum `status_conta` (`aberta` \| `recebida` \| `cancelada`) NOT NULL default `aberta` | linha do tempo do dinheiro |
| `created_at` | timestamptz NOT NULL default now | |

- **Unique em `orcamento_id`** — uma conta por orçamento (não duplica se reaprovar). RLS na mesma migration:
  GRANT app_user + ENABLE (sem FORCE) + policy `conta_receber_tenant_isolation` (formato de `0023_rls_cargo.sql`).
- Enum `status_conta` novo em `schema/enums.ts`, espelhado no domínio com teste de drift.

### O valor: capturado no momento da aprovação

O orçamento **não guarda o total** (os itens somam em `orcamento_item` via `calcularOrcamento`, que já aplica
o markup por `totalItem`). Ao aprovar, a aplicação **calcula o total e grava** em `conta_receber.valor_centavos`.
É o que permite "aberta acompanha / recebida congela": a conta tem seu próprio valor, não um cálculo derivado.

### Máquina de estados do dinheiro (domínio)

`validarTransicaoConta(de, para)`:
- `aberta` → `recebida` (a baixa — modelada agora, plugada na P-4b) ou `cancelada`.
- `cancelada` → `aberta` (reaprovação de um orçamento cujo ciclo tinha sido cancelado).
- `recebida` é **terminal** (congela — dinheiro que entrou não se reescreve).

### O gatilho: `aprovarOrcamento` cria/atualiza a conta

O `aprovarOrcamento` (`application/orcamento.ts`, já existe) passa a, **na mesma transação**:
1. Calcular o total (`calcularOrcamento` sobre os itens).
2. Se **não há conta** para o orçamento → cria `aberta` com o total.
3. Se há conta **`aberta`** → atualiza `valor_centavos` (acompanha a renegociação).
4. Se há conta **`recebida`** → **não toca** (congela — auditoria honesta).
5. Se há conta **`cancelada`** → **reabre** (volta a `aberta` com o novo total; unique mantido).

Nada de nova ação para a recepção — a conta nasce sozinha ao aprovar.

### Cancelar cobrança (ação explícita)

A máquina de estados da OS **não tem estado "cancelada"** (vai até `entregue`; não há cancelamento
automático de OS). Então cancelar a conta é uma **ação explícita da gestão** ("Cancelar cobrança"):
`aberta` → `cancelada`. Conta `recebida` não cancela (já entrou dinheiro).

## RBAC (P-1) — inclui uma permissão nova no catálogo

- **Ver a conta**: quem tem `dinheiro:ver` (Dono, Gestor, Recepção, Financeiro). O chão (produção) NÃO vê —
  a regra de ouro do cargo já barra `dinheiro:ver` em cargos de chão.
- **Cancelar cobrança** (decisão financeira sensível — a oficina abre mão de receber): restrito a
  gestão/financeiro, **a recepção NÃO cancela**. Isso exige uma **permissão nova no catálogo do P-1**:
  **`financeiro:gerir`**. O catálogo de permissões (`domain/auth/cargo.ts`) cresce de 10 para 11 chaves;
  os **cargos-semente Dono, Gestor e Financeiro ganham `financeiro:gerir`** (Recepção/Produção/Peças/Pós-venda
  não). Uma migration de dados adiciona `financeiro:gerir` aos cargos-sistema Dono/Gestor/Financeiro dos
  tenants existentes (mesmo padrão da migração de seed do P-1). Enforcement no boundary da action
  (`pode(sessao.permissoes, "financeiro:gerir")`).
  > Nota de segurança (Piso 3 do P-1): `financeiro:gerir` NÃO é gatilho de 2FA por si só (o Financeiro já
  > exige 2FA por outros motivos; adicionar não muda). `financeiro:gerir` também NÃO pode ir a cargo de chão
  > (Piso 2 já barra dinheiro em cargo `chao`; `financeiro:gerir` implica dinheiro, então some junto — a
  > validação do cargo deve tratar `financeiro:gerir` como proibida no chão, como as outras de dinheiro).

## Superfícies e telas (mínimo da P-4a)

- **Bloco "Financeiro" no detalhe da OS** (`/os/[id]`): mostra a conta — "R$ X · a receber / recebido /
  cancelado" (usa `moeda()` do `@/ui/format`) — e um botão **"Cancelar cobrança"** (só quando `aberta` e o
  cargo pode). Só exibição + cancelar. A baixa é P-4b; o relatório é P-4c.
- **`aprovarOrcamento`**: passa a criar/atualizar a conta (composição já notifica o painel).

## Invariantes (domínio, testados)

- `validarTransicaoConta` rejeita transições inválidas (ex.: `recebida`→qualquer; `aberta`→`aberta`).
- A conta captura o total no momento da aprovação; `recebida` congela o valor.
- `unique(orcamento_id)`: uma conta por orçamento.
- Isolamento por tenant absoluto (RLS; testado A↔B).

## Fatiamento (schema-first, cada fatia testável e deployável)

1. **Schema + RLS + domínio + permissão nova** — enum `status_conta`, tabela `conta_receber` + RLS (migration),
   teste de isolamento A↔B. Domínio: `validarTransicaoConta` + `STATUS_CONTA`/`type StatusConta` + drift. **E o
   RBAC**: `financeiro:gerir` entra no catálogo (`domain/auth/cargo.ts`), nos cargos-semente Dono/Gestor/
   Financeiro, e é tratada como proibida em cargo de chão (Piso 2); migration de dados adiciona a permissão aos
   cargos-sistema Dono/Gestor/Financeiro dos tenants existentes.
2. **Aplicação + composição** — `aprovarOrcamento` cria/atualiza a conta na transação (calcula total; aberta
   acompanha, recebida congela, cancelada reabre); `cancelarConta`; `contaDaOs` (leitura). Teste de isolamento
   + os casos da máquina.
3. **Bloco Financeiro no detalhe da OS** — exibe a conta + "Cancelar cobrança" (RBAC no boundary).
4. **Pipeline + deploy** — CI, migration cloud, `railway up`, smoke.

## Fora de escopo (próximas sub-fatias / futuro)

- **P-4b**: registrar pagamento/baixa (`aberta`→`recebida`), forma e data de pagamento, parcelas.
- **P-4c**: relatório financeiro (entrou no período, em aberto, atraso).
- Nota fiscal (integração fiscal, Onda 3), gateway/link de pagamento (Onda 3).
- Estado "cancelada" na máquina de estados da OS (não existe; cancelar cobrança é ação financeira separada).
- Preço por cliente, desconto, juros/multa.

## Testes (Definition of Done)

- **Unidade**: `validarTransicaoConta` (cada transição válida/inválida; `recebida` terminal), drift do enum.
- **Integração**: `aprovarOrcamento` cria a conta `aberta` com o total (A↔B isolamento); reaprovar com conta
  `aberta` atualiza o valor; com `recebida` NÃO toca; com `cancelada` reabre; `cancelarConta` só de `aberta`.
- **Regressão**: `aprovarOrcamento` continua liberando o gate de execução (o comportamento atual não muda —
  só ganha a criação da conta na mesma transação).
