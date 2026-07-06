# P-5a — Setor agrupando estações + TV por setor

> Design validado com o dono em 06/07/2026 (brainstorm). Descoberta de campo: `docs/15_backlog_produto.md` (P-5, item A).
> App EM PRODUÇÃO (Next.js + Supabase + Drizzle + RLS por tenant). Schema-first, uma fatia por vez.

## O problema (reunião de teste na oficina, 05-06/07)

A oficina real **não tem uma TV/estação por peça**. Tem **~4-5 SETORES físicos**, cada um agrupando
várias estações. Nas palavras do dono: **Usinagem** (bloco + cabeçote + virabrequim + biela + tornearia,
tudo num box só, uma TV só), **Bomba e bico**, **Desmontagem + lavagem** (desmonta e já lava),
**Montagem**, **Oficina/pátio**. Hoje `estacao` é fina (uma por peça) e a TV (P-3) mostra **uma estação**;
o dono quer **uma TV por SETOR** mostrando todas as estações do setor.

## Estado atual (verificado)

- `estacao` é **plana** (`nome` + `ordem`, sem hierarquia) e **mistura granularidades**: fases do fluxo
  (Recebimento, Desmontagem, Montagem, CQ) e estações de peça (Bloco, Cabeçote, Virabrequim, Bomba/Bico).
  O template do ramo (`domain/templates/ramo.ts`) semeia ~5-10 estações planas.
- `os.estacaoId` = estação física da OS. `quiosque_setor.estacaoId` (P-0) e `tela.estacaoId` + `modo`
  `estacao|geral` (P-3) apontam para **estação**. `/chao` agrupa por estação (`?por=estacao`).

## Decomposição do P-5 (o dono escolheu o mínimo que resolve a dor)

- **P-5a (ESTA leva)**: modelo `setor` agrupando `estacao` + migração sem quebrar + tela de gestão dos dois
  níveis + **TV por setor** (`modo=setor`). Resolve a dor central ("uma TV por setor").
- **P-5b (futura)**: quiosque por setor (o tablet do chão loga no setor, não na estação).
- **P-5c (futura)**: card do painel/TV mostrando o **setor responsável** na execução (item I da reunião).

---

## Arquitetura (P-5a): dois níveis — setor → estações

`setor` é o agrupamento físico (Usinagem, Montagem…); `estacao` continua o nível fino (bloco, cabeçote…).

### Tabela nova `setor` (por tenant, RLS — regra de ouro #7)

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL → tenant (cascade) | RLS |
| `nome` | text NOT NULL | "Usinagem", "Montagem"… |
| `ordem` | integer NOT NULL | posição no fluxo |
| `created_at` | timestamptz NOT NULL default now | |

RLS na mesma migration: GRANT app_user + ENABLE (sem FORCE) + policy `setor_tenant_isolation` (formato de
`0023_rls_cargo.sql`).

### `estacao` ganha `setor_id`

`setor_id uuid → setor(id)` com `onDelete: set null`. Cada estação pertence a um setor. Nulo transitório só
durante a migração; ao final toda estação tem setor. (Set null defende contra apagar setor por fora, mas a
aplicação **bloqueia** apagar setor com estações — ver Invariantes.)

### Migração sem quebrar (app em produção, mesma filosofia do P-1)

A migration, para cada tenant: cria **um setor por estação existente** (nome = nome da estação, mesma
`ordem`) e liga cada `estacao.setor_id` ao seu setor recém-criado. **Nada quebra** — quiosques/TVs/OS seguem
por estação. O dono depois reagrupa na tela (cria "Usinagem", move Bloco/Cabeçote/Virabrequim pra dentro,
apaga os setores sobrando). Zero downtime; ele organiza como a oficina dele é.

### Template do ramo semeia setores (tenants novos)

`criar-oficina` passa a semear os setores-padrão e distribuir as estações-template neles. `domain/templates/
ramo.ts` passa a descrever **setores → estações** (a estrutura atual de estações planas vira agrupada).

O template-semente da retífica combina **setores de peça** (com várias estações) + **setores de fase** (cada
um com 1 estação de mesmo nome — as fases atuais que não são peça viram setores próprios; o dono funde/apaga
os que não usa, nada some do fluxo):
- **Usinagem** → bloco, cabeçote, virabrequim, biela, tornearia
- **Bomba e bico** → bomba/bico
- **Desmontagem + lavagem** → desmontagem, lavagem
- **Montagem** → montagem
- **Oficina/pátio** → oficina/pátio
- Fases como setor-de-uma-estação: **Recebimento**, **Metrologia**, **Controle de Qualidade**, **Expedição**
  (cada um um setor com a estação homônima).

Os ramos `retifica_leve` e `centro_automotivo` recebem um agrupamento análogo (setores de peça + fases como
setor-de-uma-estação), derivado das estações que já têm hoje. Teste de drift do enum permanece.

### O que a OS usa

A OS continua com `estacao_id` (a estação física). O **setor é derivado** por join (estação → setor). **NÃO
mexemos em `os.estacaoId`** — mantém a fatia contida. `/chao` (`?por=estacao`) segue funcionando.

### A TV (P-3) ganha `modo=setor`

O enum `modo_tela` cresce: `estacao | geral | setor`. A tabela `tela` ganha `setor_id` (nulo exceto quando
`modo=setor`, espelhando `estacao_id`). Em `modo=setor`, o `dadosTv` filtra os cards por **todas as estações
do setor** (join). `modo=estacao` (uma estação) e `geral` (tudo) permanecem. O quiosque (P-0) **NÃO muda**
nesta fatia (continua por estação — é a P-5b).

## Invariantes (domínio, testados)

- **`validarSetor`**: `nome` não vazio. (Simples; `ordem` é gerida pela aplicação.)
- **`validarTela` cresce**: `modo=setor` exige `setor_id`; `estacao` exige `estacao_id`; `geral` exige ambos
  nulos. (Estende o invariante do P-3.)
- **Apagar setor bloqueia se tem estações**: a aplicação rejeita apagar um setor com estações
  (`DadosInvalidosError` "Mova as estações antes de remover o setor."). Nenhuma estação órfã; nenhum
  `tela.setor_id`/derivação apontando pra setor que sumiu. (Mesmo espírito do "cargo de sistema não exclui"
  do P-1 e do "estação com OS não remove" atual.)
- **Isolamento por tenant absoluto**: `setor` tem `tenant_id` + RLS; testado A↔B.

## Superfícies e telas

- **`/config/setores`** (evolui a `/config/estacoes`; gate `config:editar`): mostra **setores como grupos,
  estações aninhadas**. CRUD de setor (criar/renomear/reordenar; apagar só se vazio). CRUD de estação dentro
  de um setor. **Mover estação entre setores** via `<select>` de setor por estação (sem drag-and-drop — YAGNI).
  Reusa o padrão de `editor-estacoes.tsx` (CRUD + `useTransition`), estendido a dois níveis.
- **`/config/telas`** (P-3): o seletor "O que a tela mostra" ganha **"Um setor"** → escolhe qual. `modo=setor`.
- **`dadosTv`** (P-3): em `modo=setor`, filtra os cards pelas estações do setor.
- **RBAC**: todas as actions no boundary por `pode(sessao.permissoes, "config:editar")` (padrão de config).

## Fatiamento (schema-first, cada fatia testável e deployável)

1. **Schema `setor` + `estacao.setor_id` + RLS + migração + seed do template** — cria `setor`, migra (1 setor
   por estação existente + liga), `criar-oficina`/`ramo.ts` semeiam setores→estações. Domínio `validarSetor`.
   Teste de isolamento A↔B + a migração liga tudo (nenhuma estação com `setor_id` nulo ao fim). *(fatia
   crítica — mexe em produção)*
2. **Aplicação + composição** — CRUD de setor (criar/renomear/reordenar/apagar-se-vazio) + `moverEstacao`
   (troca `setor_id`) + `listarSetoresComEstacoes`. Teste de isolamento + o bloqueio de apagar setor com
   estações.
3. **Tela `/config/setores`** — dois níveis (setor → estações), mover estação, CRUD + nav.
4. **`modo=setor` na TV** — enum `modo_tela` += setor; `tela.setor_id`; `validarTela` cresce; o seletor em
   `/config/telas`; `dadosTv` filtra por setor. (Migration do enum + coluna.)
5. **Pipeline + deploy** — CI verde, migration cloud via `railway run`, `railway up`, smoke.

Cada fatia testável isoladamente; teste de isolamento explícito onde toca dados (fatias 1, 2, 4).

## Fora de escopo (fatias/produtos futuros)

- **P-5b**: quiosque por setor.
- **P-5c**: card do painel/TV com o setor responsável (item I da reunião).
- Drag-and-drop pra mover estação (o `<select>` basta).
- Reagrupamento automático das estações migradas (o dono organiza — cada oficina divide diferente).
- Estação sem setor como estado suportado (bloqueamos apagar setor com estações, então não surge).

## Testes (Definition of Done)

- **Unidade**: `validarSetor` (nome vazio rejeita); `validarTela` estendido (setor exige setor_id; os outros
  nulos); drift do template setores→estações.
- **Integração**: rotas de setor + DB com **teste de isolamento A↔B** (fatias 1, 2, 4); a migração liga cada
  estação a um setor (0 estações com setor_id nulo); apagar setor com estações rejeita; `moverEstacao` troca
  o setor.
- **Comportamento**: `dadosTv` em `modo=setor` retorna os cards de todas as estações do setor (e só delas).
