# Design — Catálogo de Serviços com Preço (P-2)

> Spec de design validado com o dono (brainstorming, 03/07/2026). É o **P-2 do backlog de produto**
> ([docs/15](../../15_backlog_produto.md)): a recepção para de digitar TODO item do orçamento à mão —
> seleciona serviços pré-cadastrados com preço. Ganho: velocidade + padronização de preço. Schema-first.

## Problema

Hoje, montar um orçamento é digitar cada linha à mão no builder (`src/app/os/[id]/orcamento.tsx`): tipo,
descrição, valor em reais, markup%. Toda OS repete o mesmo trabalho, e o preço de um mesmo serviço varia
conforme quem digita. Não há uma tabela de preços da oficina.

## Solução: o catálogo é uma FONTE DE SUGESTÃO

Uma tabela de serviços por tenant (nome, tipo, valor, markup). No orçamento, um botão **"Do catálogo"**
copia o serviço escolhido para uma **linha editável** do orçamento — daí em diante é uma linha comum, e o
preço vive independente. **Decisão central (dono): o preço do catálogo é sugestão, não verdade.** Escolher
copia; a recepção pode ajustar naquela OS; e **mudar/apagar o serviço no catálogo NÃO altera orçamentos já
feitos** (documento histórico — padrão de sistemas de dinheiro). Isso mantém a mudança pequena: o
`montarOrcamento` não muda em nada, e o `orcamento_item` NÃO ganha vínculo (FK) com o serviço.

```
GESTÃO (/servicos — recepção + gestão)          ORÇAMENTO DA OS (builder atual)
┌──────────────────────────────────┐            [ + Adicionar item ] [ + Do catálogo ▼ ]
│ Mão de obra                       │                  ↓ escolhe "Retífica de cabeçote"
│   Retífica de cabeçote   R$450 [✎]│            preenche linha editável:
│ Peça                              │            [Mão de obra|Retífica de cabeçote|450,00|0%|✕]
│   Jogo de juntas         R$120 [✎]│                  ↑ ajustável naquela OS (é cópia)
│ Terceiro                          │
│   Solda   R$200 +20%          [✎] │
│ [+ Novo serviço] [Reajustar +%]   │
└──────────────────────────────────┘
```

## Decisões (com quem decidiu)

- **Preço = sugestão** (a OS copia e vira dona; catálogo não é fonte de verdade). **Dono.**
- **Quem gerencia o catálogo: recepção + gestão** (`orcamento:editar`). Ágil pra oficina pequena; implica
  que a recepção pode mudar a tabela de preços (aceito). **Dono.**
- Tela em **`/servicos`** — item próprio na navegação (usado com frequência). **Dono.**
- **Agrupado por tipo** (Peça / Mão de obra / Terceiro — o enum que o orçamento já usa). **Dono.**
- Serviço guarda **markup padrão** (%) além do valor. **Dono.**
- **Desativar/reativar** (flag `ativo`), não apaga — preserva histórico, mesmo padrão do "desativar membro". **Dono.**
- Escopo: **enxuto + reajuste em massa** (+/−X% nos ativos). **Dono.**

## Modelagem (migration nova, aditiva/segura em prod)

**Tabela `servico`** (padrão da `estacao`: config por tenant com RLS):
| Coluna | Tipo | Papel |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK tenant (cascade) | RLS por tenant |
| `nome` | text | "Retífica de cabeçote" |
| `tipo` | `tipo_item_orcamento` (enum EXISTENTE: peca/mao_de_obra/terceiro) | fala a mesma língua da linha do orçamento |
| `valor_centavos` | integer | dinheiro em centavos inteiros (padrão do app) |
| `markup_pct` | integer default 0 | markup padrão (ex.: 20 pra terceiro) |
| `ativo` | boolean default true | desativa sem apagar |
| `created_at` | timestamptz default now | |

- **RLS por tenant na MESMA migration** (regra de ouro #7): `GRANT app_user` + `ENABLE` (sem FORCE) +
  policy `USING/WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)`. Padrão idêntico
  ao 0019 (quiosque) / 0011 (orçamento).
- **Reusa o enum `tipo_item_orcamento`** — o serviço copia direto pra linha do orçamento (tipo→tipo,
  valor→valor, markup→markup).
- **`orcamento_item` NÃO muda** — sem `servico_id`, sem FK. É o que garante que o catálogo é sugestão.

## Camadas (arquitetura do Igni)

**Domínio puro (`domain/orcamento/servico.ts`):**
- `validarServico({nome, valorCentavos, markupPct})` — nome não-vazio, valor ≥ 0 inteiro, markup ≥ 0 inteiro.
- `aplicarReajuste(centavos, pct)` → `Math.round(centavos * (100 + pct) / 100)`. Puro, testável sem banco.
  Aceita pct negativo (desconto). Arredonda ao centavo.

**Aplicação (`application/servico.ts`) — tudo `withTenant` (RLS):**
- `listarServicos(database, sessao, { incluirInativos })` → `ServicoView[]` (id, nome, tipo, valorCentavos, markupPct, ativo).
- `criarServico(database, sessao, {nome, tipo, valorCentavos, markupPct})` — valida; lança `DadosInvalidosError`.
- `editarServico(database, sessao, id, {nome, tipo, valorCentavos, markupPct})`.
- `desativarServico(database, sessao, id)` / `reativarServico(database, sessao, id)`.
- `reajustarPrecos(database, sessao, pct)` — aplica `aplicarReajuste` em `valor_centavos` de **todos os
  serviços ATIVOS** do tenant, numa transação. Conveniência (o dono revê depois); **só toca o catálogo**,
  nunca orçamentos já feitos. Valida `pct` num intervalo sensato (ex.: −90 a +200) pra evitar erro grosseiro.
  **UX:** o botão "Reajustar todos" pede o percentual e **confirma** antes de aplicar ("Vai mudar N serviços
  em +X%. Confirmar?") — muda muitos valores de uma vez, então exige o passo explícito. Sem "desfazer" nesta
  leva (o dono pode reajustar de volta com o percentual inverso, ou editar manualmente).

**Composição (`composition/servico.ts`):** wrappers `*NoTenant` injetando `database`. É o que a web importa
(boundary guard: `src/app` nunca importa `db` direto). O "Do catálogo" no orçamento lê `listarServicosNoTenant`.

**Web:**
- `/servicos` (RSC + client): lista agrupada por tipo, criar/editar/desativar/reativar, botão "Reajustar
  todos +%". RBAC `orcamento:editar`. Item "Serviços" na nav.
- Builder do orçamento (`orcamento.tsx`): botão "Do catálogo" abre um seletor (agrupado por tipo, só ATIVOS)
  → escolher faz `push` de uma linha nova nas `linhas` que o builder já gerencia, preenchida com o serviço.
  **`montarOrcamento` não muda.**

## Fatiamento (schema-first, cada fatia testável e deployável)

1. **Schema + migration** — `servico` + RLS + teste de isolamento multi-tenant.
2. **Domínio puro** — `validarServico` + `aplicarReajuste` (testes puros).
3. **Aplicação** — CRUD + `reajustarPrecos`, com teste de isolamento A↔B (reajuste de A não toca B).
4. **Composição + `/servicos`** — CRUD agrupado por tipo + reajuste em massa + nav.
5. **Integração no orçamento** — botão "Do catálogo" que preenche a linha (sem tocar `montarOrcamento`).
6. **Pipeline (typecheck/lint/build/test) + CI verde + deploy + smoke.**

## Fora desta leva (backlog)
- Histórico de preço (quando mudou, de quanto pra quanto).
- Importar/exportar planilha do catálogo.
- Preço por cliente / múltiplas tabelas de preço.
- Vínculo (FK) orçamento↔serviço e relatório "quanto esse serviço rendeu" — exigiria o vínculo que
  decidimos NÃO ter (o preço é sugestão).

## Verificação (Definition of Done)
- typecheck/lint/build verdes; **CI verde** antes do deploy (Postgres limpo).
- Teste de isolamento multi-tenant em toda fatia que toca dados (regra de ouro #7): catálogo/reajuste de
  A nunca vê/afeta B.
- Teste de que "adicionar do catálogo" não muda o `montarOrcamento` (o item vira linha comum, editável).
- Migration só via Drizzle; deploy Railway CLI; sem Playwright.
