# P-1 — Cargos configuráveis por tenant (nomenclatura + estrutura de setores/papéis)

> Design validado com o dono em 03/07/2026 (brainstorm). Backlog de produto: `docs/15_backlog_produto.md` (P-1).
> App EM PRODUÇÃO (Next.js + Supabase + Drizzle + RLS por tenant). Schema-first, uma fatia por vez.

## O problema (nas palavras do dono)

1. *"Por que a equipe teria senha se eles vão ter a TV pra acompanhar?"* — resolvido no **P-0** (quiosque de setor + PIN: o chão avança OS sem senha o dia todo, PIN individual carimba quem foi).
2. *"Precisa pôr a nomenclatura correta das funções da equipe: Produção, Financeiro, Compras, Pós-venda…"* — **é o alvo desta leva.** Hoje só existem 4 papéis genéricos e fixos; não refletem a estrutura real de uma retífica.

## O alvo desta leva

**Nomenclatura + novos papéis**, entregues como **cargos configuráveis por tenant**: o dono cria/renomeia cargos (nome livre) e compõe as permissões de cada um a partir de um **catálogo fixo** que o código sabe fazer valer. Semeamos os cargos que faltam (Financeiro, Peças/Compras, Pós-venda) além dos 4 atuais.

Não é: um motor de permissões 100% livre por campo (YAGNI — nenhuma oficina pediu). Não é: repensar o acesso do chão (o P-0 já resolveu).

## Validação de mercado (pesquisa, 03/07)

Duas pesquisas independentes (ERPs de oficina BR/intl + padrão RBAC de SaaS) confirmaram o desenho:

- **Estrutura correta**: cargos com nome livre + catálogo fixo de permissões é o padrão de Tekmetric, GestãoClick, vhsys **e** dos grandes SaaS (GitHub, Slack, Stripe, Atlassian, Google).
- **Nomenclatura bate 1:1**: Dono/Gestor/Recepção/Produção ↔ Owner/Manager/Service Advisor/Technician. Financeiro é universal.
- **`cargo:gerir` é exclusivo do topo** em 5/5 SaaS e no Tekmetric (que separa "editar funcionário" de "editar permissões"). → decisão: só o Dono redesenha cargos.
- **Compras e Estoque = mesma pessoa** na oficina real → cargo único "Peças/Compras", não dois.
- **Pós-venda** é forte em concessionária, fraco em oficina pequena (lá é atividade da recepção) → entra como cargo-semente **opcional**.
- **Quiosque + PIN** valida perfeitamente contra o padrão de "apontamento de produção por terminal compartilhado com PIN individual" (o P-0 está bem-desenhado, HMAC melhor que o "usuário+senha compartilhados" dos concorrentes).

Fontes registradas na conversa do brainstorm (não repetidas aqui para não inchar o spec).

---

## Arquitetura: cargo como dado, permissão do catálogo fixo

Hoje `usuario.papel` é um enum de 4 valores (`dono/gestor/recepcao/producao`), consumido pelo login, pelo 2FA (`exigeMfa`), pelo RBAC (`pode`/`assertPode`), pelo quiosque e pela tela de Equipe.

Introduzimos uma tabela **`cargo`** por tenant. O `usuario` passa a apontar para um `cargo_id`. O **catálogo de permissões vive no código** (domínio), não no banco — o dono combina permissões conhecidas; não inventa permissões novas. Isso mantém a flexibilidade onde importa (nome + combinação, por oficina, sem deploy) e a blindagem onde importa (o que cada permissão faz é código testado contra vazamento).

### Tabela `cargo`

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL → tenant (cascade) | RLS por tenant (regra de ouro #7) |
| `nome` | text NOT NULL | livre ("Financeiro", "Comprador Chefe") |
| `sistema` | boolean NOT NULL default false | cargo-semente travado |
| `chao` | boolean NOT NULL default false | é cargo de quiosque/chão? |
| `permissoes` | text[] NOT NULL default '{}' | chaves do catálogo fixo |
| `exige_2fa` | boolean NOT NULL default false | piso pode forçar true; nunca rebaixa (Piso 3) |
| `created_at` | timestamptz NOT NULL default now() | |

- `usuario.cargo_id`: uuid → cargo (por tenant). Nulo transitório só durante a migração; ao final todo usuário tem cargo.
- RLS: `GRANT app_user` + ENABLE (sem FORCE) + policy `USING/WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)` — mesmo formato de `0021_rls_servico.sql`.

## Catálogo fixo de permissões (domínio)

Evolui o `ACOES` atual. Cada chave é uma capacidade que a UI esconde/mostra (`pode`) e o servidor barra (`assertPode`):

| Chave | Libera |
|---|---|
| `os:abrir` | Abrir OS nova |
| `os:editar` | Editar dados da OS |
| `os:avancar` | Avançar etapa (o "bump" do chão) |
| `triagem:override` | Mudar prioridade manualmente |
| `orcamento:editar` | Montar/editar orçamento |
| `dinheiro:ver` | Ver valores (orçamento, preços, financeiro) |
| `dinheiro:ver_peca` | Ver só o custo de peça (subconjunto de dinheiro) |
| `cadastro:editar` | Editar clientes/equipamentos |
| `equipe:gerir` | Convidar/desativar membros, **atribuir cargos existentes** |
| `config:editar` | Estações, quiosque, templates |

> `dinheiro:ver` é guarda-chuva; quem o tem implicitamente vê peça (`dinheiro:ver_peca`). `equipe:gerir` NÃO inclui redesenhar cargos.
>
> **`cargo:gerir` NÃO entra no catálogo atribuível.** É capacidade **implícita e exclusiva do cargo Dono** (travado). Assim a única entidade que redesenha cargos já é o topo imutável — o problema de auto-escalonamento some sem precisar de travas complexas (não-conceder-o-que-não-tem etc.).

## Cargos-semente (criados em todo tenant)

| Cargo | sistema | chão | `exige_2fa` | Permissões |
|---|---|---|---|---|
| **Dono** | ✅ imutável | — | true | todas + `cargo:gerir` (exclusivo) |
| **Gestor** | ✅ | — | true | todo o catálogo **exceto** `cargo:gerir` |
| **Recepção** | ✅ | — | false | os:abrir, os:editar, os:avancar, orcamento:editar, dinheiro:ver, cadastro:editar, triagem:override |
| **Produção** | ✅ | ✅ | false | os:avancar |
| **Financeiro** | ✅ | — | true | dinheiro:ver, orcamento:editar, os:editar |
| **Peças/Compras** | ✅ | — | false | dinheiro:ver_peca, os:avancar |
| **Pós-venda** | ✅ (opcional) | — | false | os:avancar, cadastro:editar |

> Dono/Gestor têm `exige_2fa=true` por nascerem com `equipe:gerir`/`config:editar`/`cargo:gerir` (o Piso 3 forçaria mesmo se viesse false). Financeiro nasce com o flag true. Recepção tem `dinheiro:ver` mas `exige_2fa=false` — `dinheiro:ver` não é gatilho.

- Cargos de sistema: **nome editável** pelo dono; **permissões read-only** (segue Google/Tekmetric — prebuilt roles não se editam).
- Cargos customizados que o dono criar nascem do zero, **sem** `equipe:gerir`.
- "Pós-venda" é semeado mas posicionado como opcional (a oficina pequena pode ignorar; a recepção cobre o pós-venda).

## Os 4 pisos de segurança (invariantes de código, testados)

**Piso 1 — Cargo Dono imutável + "último Dono".** O cargo `Dono` não pode ser apagado, ter permissão removida, nem rebaixado. Sempre há ≥1 usuário ativo com cargo Dono — a Equipe barra desativar/rebaixar o último Dono. Impede lockout. Custom roles nascem sem `equipe:gerir`.

**Piso 2 — Regra de ouro travada.** Um cargo `chao=true` **não pode** receber `orcamento:editar`, `dinheiro:ver` nem `dinheiro:ver_peca`. A validação rejeita na origem. A regra de ouro do CLAUDE.md deixa de depender de disciplina e vira invariante.

**Piso 3 — 2FA é um piso, nunca um teto.** Cada cargo carrega `exige_2fa` próprio. Os cargos-semente nascem com o valor certo (Dono/Gestor/Financeiro = true; Recepção/Produção/Peças/Pós-venda = false). Um cargo com `equipe:gerir`, `config:editar` ou `cargo:gerir` (ou, no futuro, o módulo financeiro do P-4) **força `exige_2fa=true`** — o dono não consegue desligar. **`dinheiro:ver` sozinho NÃO é gatilho** (a recepção vê valores o dia todo sem 2FA — preservar o comportamento atual, incl. a conta de teste `dev@igni.app` = recepção sem 2FA), nem `dinheiro:ver_peca`. `exigeMfa(cargo)` = `cargo.exige_2fa || temPermissaoGatilho(cargo.permissoes)`; deixa de olhar lista fixa de papéis. Financeiro tem 2FA porque nasce com o flag, não por ver dinheiro.

**Piso 4 — Isolamento por tenant absoluto.** Nenhuma permissão alcança dado de outro tenant. `cargo` tem `tenant_id` + RLS na mesma migration; `cargo_id` é por tenant. Testado A↔B como toda tabela nova.

## Superfícies e telas

- **`/config/cargos`** (novo; só quem tem `cargo:gerir` = Dono): lista os cargos do tenant; cria/renomeia/edita permissões dos customizados; renomeia os de sistema. Matriz de checkboxes do catálogo com os pisos ao vivo: `chao` cinza-desabilita as caixas de dinheiro/orçamento (Piso 2); permissão-gatilho (`equipe:gerir`/`config:editar`/`cargo:gerir`) acende o selo "Exige 2FA" travado (Piso 3); cargo Dono read-only com cadeado (Piso 1); cargos de sistema com permissões read-only. O toggle `exige_2fa` é editável só quando nenhum gatilho o força.
- **`/config/equipe`**: o seletor troca de "4 papéis fixos" para "cargos do tenant". Protege o último Dono (Piso 1).
- **Middleware/2FA**: `exigeMfa` derivado das permissões do cargo (Piso 3).
- **`sessaoAtual()`**: resolve o cargo do usuário e carrega suas permissões (fonte de verdade do RBAC).

## Compatibilidade — migração sem quebrar (app em produção)

1. Migration cria `cargo` + RLS, **semeia os cargos-semente em cada tenant existente**, e liga cada `usuario.cargo_id` ao cargo correspondente ao seu `papel` atual (dono→Dono, gestor→Gestor, recepcao→Recepção, producao→Produção).
2. O enum `papel` **permanece na tabela como legado tolerado** — o `cargo` vira a fonte de verdade do RBAC; o `papel` só é removido numa limpeza futura. Evita um big-bang arriscado com gente logada.
3. `pode()`/`assertPode()` passam a receber o **conjunto de permissões do cargo** em vez do papel.

## Fatiamento (schema-first, cada fatia testável e deployável)

1. **Schema + RLS + seed + migração** — tabela `cargo`, `usuario.cargo_id`, migration que semeia por tenant e liga usuários existentes. Teste de isolamento A↔B. *(fatia mais crítica — mexe em produção)*
2. **Domínio dos cargos** — catálogo de permissões; `validarCargo` (os 4 pisos); `exigeMfa(cargo)` = `cargo.exige_2fa || temPermissaoGatilho(cargo.permissoes)`; `pode(permissoes, acao)`. Puro, muito testável.
3. **Aplicação + composição** — listar/criar/editar/renomear cargos; resolver permissões na sessão; proteção do "último Dono". Teste de isolamento.
4. **Tela `/config/cargos`** — CRUD com os pisos ao vivo + nav.
5. **Migrar Equipe + RBAC consumidores** — seletor de cargo na Equipe; trocar os `pode(papel,…)` para o novo modelo; middleware de 2FA derivado. *(fatia de integração — toca muitas superfícies)*
6. **Pipeline + deploy** — CI verde, migration cloud, `railway up`, smoke.

## Fora de escopo (fatias/produtos futuros)

- Escopo de dados por cargo ("ver só as OS próprias" vs todas) — melhoria de segurança que o vhsys explora; registrar como follow-up.
- Módulos que dão poder de verdade aos cargos novos: **Financeiro** (P-4), **peças/compras** (feature futura), **pós-venda** (feature futura). Os cargos já fazem algo real hoje; ganham mais quando as telas chegarem.
- Remoção definitiva do enum `papel`.
- Delegar `cargo:gerir` ao Gestor (só se um cliente pedir; exige as travas anti-escalonamento completas).
- Auditoria de mudanças de cargo (trilha de quem alterou o quê).

## Testes (Definition of Done)

- **Unidade**: `validarCargo` (cada um dos 4 pisos rejeitando/aceitando), `exigeMfa(cargo)` (flag próprio + gatilho forçando true; `dinheiro:ver` NÃO dispara; Recepção fica sem 2FA), `pode(permissoes, acao)`, catálogo × cargos-semente (drift).
- **Integração**: rotas de cargo + DB com **teste de isolamento multi-tenant A↔B** (fatias 1 e 3); a migração de seed liga usuários existentes ao cargo certo.
- **Regressão**: os consumidores de `pode(papel,…)` continuam barrando/liberando igual após a troca (fatia 5).
