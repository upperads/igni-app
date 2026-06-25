# Igni — Referência Técnica

> Para o dev/agente que vai implementar M5 UI e M6 portal **sem reverse-engineering**.
> Documenta o que o código **faz** (não o que ele é). Fonte da verdade = o código; isto é o mapa.
> Cruza com: [SDD](09_sdd.md) · [Code Review](10_code_review.md) · [ADRs](adr/) · CLAUDE.md.
> Estado: M1–M4 em produção; M5 (orçamento) com **domínio + casos de uso prontos e testados, UI faltando**.

## Setup (5 passos)
1. `pnpm install` (pnpm@10.33.0, Node ≥20 — pinados em `package.json`).
2. Copie `.env.example` → `.env`. Local usa Supabase local (portas 544xx) + Postgres de teste (5433).
3. Suba as dependências: Supabase local (`supabase start`) e o Postgres de teste (`docker start igni-db`).
4. `pnpm db:migrate` (aplica as migrations Drizzle no `DATABASE_URL`).
5. `pnpm dev` → http://localhost:3000. Conta de teste: `dev@igni.app` / `IgniDev!2026` (recepção, sem 2FA).

Verificação: `pnpm typecheck && pnpm lint && pnpm build && pnpm test` (88+ testes). Deploy: `railway up --service igni-app --ci` (CLAUDE.md).

---

## 1. Arquitetura — camadas hexagonais

```
src/
  domain/        ← lógica PURA: sem DB, sem framework, sem relógio (agora é injetado). Testável isolada.
    os/          estado.ts · triagem.ts · painel.ts
    orcamento/   orcamento.ts
    auth/        papel.ts · rbac.ts · lockout.ts · forca-senha.ts
    shared/      errors.ts · assert-never.ts
  application/   ← CASOS DE USO: orquestram domínio + DB via `database` injetado. Escopados por tenant.
    abrir-os.ts · executar-transicao.ts · triagem.ts · orcamento.ts · criar-oficina.ts · login.ts
  infra/         ← adaptadores: DB, auth, realtime.
    db/          connection.ts (withTenant) · client.ts · schema/ · migrations/
    composition/ os.ts  ← LIGA casos de uso + queries de leitura ao tenant; chama recalc + notificar
    auth/        supabase-*.ts · sessao.ts · perfil-repo.ts
    realtime/    notificar.ts (broadcast)
  app/           ← Next App Router: páginas (Server Components) + server actions ("use server")
  ui/            ← componentes de apresentação + design tokens (sinal.ts, components/)
```

**Fluxo de uma request (escrita):**
```
Server Action (src/app/**/actions.ts, "use server")
  → sessaoAtual()                      // resolve {tenantId, usuarioId, papel} do cookie
  → wrapper de composição (infra/composition/os.ts)   // injeta `database`
    → caso de uso (application/*)      // regras + persistência
      → database.withTenant(tenantId, tx => ...)       // abre tx com RLS ativa
        → função(ões) de domínio puro  // decisão (validarTransicao, razaoCritica, …)
    → recalcularPrioridade + notificarPainel           // efeitos pós-escrita
  → revalidatePath / redirect          // Next revalida a tela
```
**Leitura** é igual sem os efeitos: Server Component → composição (`listarPainel`/`detalheOs`/…) → `withTenant` → render.

**Regra de ouro das camadas:** `domain` não importa `application`/`infra`; `application` recebe `database` por parâmetro (não importa o singleton); só `infra/composition` e `infra/*` tocam o `database`. `src/app` **nunca** importa o `db` privilegiado (guard do eslint, §2).

---

## 2. Multi-tenancy (o coração) — `withTenant` + RLS

**Duas conexões** ([infra/db/client.ts](../src/infra/db/client.ts)):
- `db` — **privilegiada, bypassa RLS**. Só para onde NÃO há tenant corrente: migrations e onboarding (`criarOficina`) e a futura resolução de token do portal (§9).
- `database.withTenant(tenantId, fn)` — o caminho normal. Por transação, faz ([connection.ts](../src/infra/db/connection.ts)):
  ```
  select set_config('app.current_tenant', $tenantId, true);  -- GUC local à tx
  set local role app_user;                                    -- papel NÃO-privilegiado, sujeito à RLS
  -- valida tenantId como UUID antes (fail-closed; um não-UUID quebraria o cast ::uuid da policy)
  ```
- As **políticas RLS** comparam `tenant_id = current_setting('app.current_tenant', true)::uuid`. Sem o GUC, `current_setting(...,true)` → NULL → **zero linhas** (fail-closed). Ver [0001_rls](../src/infra/db/migrations/0001_rls_tenant_isolation.sql).

**Padrão de RLS por tabela** (toda tabela com `tenant_id`): numa migration custom `rls_*`:
```sql
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE "x" TO app_user;
ALTER TABLE "x" ENABLE ROW LEVEL SECURITY;          -- (sem FORCE: o caminho privilegiado bypassa — ADR-005)
CREATE POLICY x_tenant_isolation ON "x"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
```
Exemplos: [0007](../src/infra/db/migrations/0007_rls_os_m2.sql), [0009](../src/infra/db/migrations/0009_rls_ajuste_prioridade.sql), [0011](../src/infra/db/migrations/0011_rls_orcamento.sql). A tabela `tenant` é self-isolation (`id = current_setting…`) e usa FORCE.

**REGRAS INEGOCIÁVEIS:**
1. **Nunca** use `db` privilegiado em `src/app` — o eslint boundary guard bloqueia importar `db`/`database` de `@/infra/db/client` em `src/app/**`. Passe pela composição.
2. **Toda tabela nova nasce com `tenant_id` + RLS na MESMA leva de migration.**
3. Dentro de `withTenant`, **nunca** SQL raw concatenado com input do usuário (o GUC é re-gravável; só Drizzle parametrizado).

---

## 3. Modelo de dados ([schema/](../src/infra/db/schema))

| Tabela | Chaves/campos | Relações | Notas |
|---|---|---|---|
| `tenant` | id, nome, template_ramo | raiz | É o tenant (sem tenant_id); RLS self |
| `usuario` | id, tenant_id, nome, email, papel, auth_user_id | →tenant | papel: dono/gestor/recepcao/producao; link lógico ao Supabase Auth |
| `estacao` | id, tenant_id, nome | →tenant | semeada por template no onboarding |
| `cliente` | id, tenant_id, nome, contato_whatsapp, tipo | →tenant | tipo: frota/produtor/avulso (LGPD) |
| `equipamento` | id, tenant_id, cliente_id, tipo, placa, chassi, modelo_motor, maquina_unica | →cliente | **placa/chassi = dados pessoais (LGPD)** |
| `entrada` | id, tenant_id, cliente_id, modalidade, pecas_recebidas, fotos | →cliente | modalidade: so_usinagem/empresa_retira/ja_desmontado |
| `os` | id, tenant_id, entrada_id, equipamento_id, estacao_id, responsavel_id, tipo_servico, **estado**, **prioridade/prioridade_score/prioridade_override**, **travado/travamento_motivo/travamento_responsabilidade**, **cq_aprovado**, prazo_prometido, entrou_no_estado_em, created_at | →entrada,equipamento,usuario | núcleo; estado dirigido pela máquina (ADR-008) |
| `evento` | id, tenant_id, os_id, de_estado, para_estado, por_usuario_id, motivo, em | →os | **a linha do tempo** (RF-11); base do histórico de culpa (F-Resp) |
| `ajuste_prioridade` | id, tenant_id, os_id, de_prioridade, para_prioridade, motivo, por_usuario_id, em | →os | auditoria de override (US-07) |
| `orcamento` | id, tenant_id, os_id (UNIQUE), **status**, **token_hash, token_expira_em**, enviado_em/aprovado_em/recusado_em | →os | 1 por OS; token hash+expiração (ADR-012) |
| `orcamento_item` | id, tenant_id, orcamento_id, tipo, descricao, **valor_centavos (int)**, **markup_pct (int)** | →orcamento | dinheiro em CENTAVOS; markup % inteiro |

**Enums** ([enums.ts](../src/infra/db/schema/enums.ts)): `papel_usuario`, `template_ramo`, `estado_os` (9 estados), `modalidade_entrada`, `tipo_cliente`, `prioridade_os` (critica/alta/normal/baixa), `responsabilidade` (empresa/cliente), `status_orcamento` (rascunho/enviado/aprovado/recusado), `tipo_item_orcamento` (peca/mao_de_obra/terceiro). **Teste de drift** garante que cada enum do banco espelha o array do domínio.

---

## 4. Domínio — contratos das funções puras

### Máquina de estados ([os/estado.ts](../src/domain/os/estado.ts)) — ADR-008
- `ESTADOS_OS`: aberta→diagnostico→orcamento→aguardando_aprovacao→(aguardando_peca)→execucao→controle_qualidade→pronta→entregue.
- `validarTransicao(de, para, contexto): {ok, motivo?}` — estrutura + **gates** (RN-01): execução exige `contexto.orcamentoAprovado`; CQ→pronta exige `contexto.cqAprovado`.
- `proximoBump(estado): EstadoOS | null` — o único passo adiante (null se ramifica/termina). Base do "bump".
- `proximosEstados(estado)`, `quatroPerguntas(estado)`, `rotuloEstado(estado)`.

### Triagem ([os/triagem.ts](../src/domain/os/triagem.ts)) — ADR-009
- `razaoCritica({diasRestantes, trabalhoRestante, gatilhos}, config?): {score, prioridade}` — urgência = trabalho/dias (+bônus atraso) + pesos dos gatilhos; bucket por limiares.
- `trabalhoRestante(estado)`, `diasRestantesAte(prazoISO, agora)` (UTC), `gatilhosAtivos({tipoCliente, maquinaUnica, houveCqReprovado})`.
- `ordenarFila(itens)` — **regra da vez**: prioridade manda; travado-por-cliente cede a vez (dentro do bucket); empresa mantém; desempate score→FIFO.
- `CONFIG_TRIAGEM_PADRAO` — pesos/limiares **configuráveis** (injetáveis). (Review 🟢: o piso 0.5 de `urgenciaBase` ainda é número mágico — mover para a config.)

### Painel ([os/painel.ts](../src/domain/os/painel.ts))
- `sinalDaOs({prioridade, travado, diasRestantes}): Sinal` — precedência travado→aguardando, crítica→critico, atraso, alta→atencao, emdia.
- `culpaDoAtraso({travado, responsabilidade, estado}): 'nossa'|'cliente'|'peca'` — **o diferencial único** (pesquisa [08](08_pesquisa_mercado.md)).
- `calcularKpis(itens): {naCasa, paradaCritica, travadas, atraso:{total,nossa,cliente,peca}}`.

### Orçamento ([orcamento/orcamento.ts](../src/domain/orcamento/orcamento.ts))
- Status helpers: `podeEditarItens`/`podeEnviar(status,qtd)`/`podeDecidir`/`podeReabrir`/`aprovado(status)`.
- `totalItem({valorCentavos, markupPct})` = valor + round(valor*markup/100), **em centavos** (sem float).
- `calcularOrcamento(itens): {porTipo, total}` — subtotais por tipo + total, centavos.

---

## 5. Casos de uso (application) — assinatura · efeito · **ligado?**

Todos recebem `(database, sessao, …)` e rodam dentro de `withTenant`.

| Caso de uso | Efeito | Ligado na UI? |
|---|---|---|
| `abrirOS` | cria cliente+equipamento+entrada+os(aberta)+evento | ✅ via `abrirOsNoTenant` ← `acaoAbrirOs` |
| `executarTransicao` | valida (gates) → muda estado + evento; reseta cq ao reentrar no CQ | ✅ via `transicionarNoTenant` |
| `recallTransicao` | desfaz a última transição + evento | ✅ |
| `recalcularPrioridade`/`aplicarPrioridade` | calcula+persiste score/bucket | ✅ (pós cada mutação) |
| `ajustarPrioridade` | override + auditoria | ✅ |
| `travar`/`destravar` | trava com motivo+responsabilidade | ✅ |
| **`montarOrcamento`** | cria rascunho + substitui itens | ❌ **falta UI (M5)** |
| **`enviarOrcamento`** | status enviado + gera token (hash+exp) | ❌ **falta UI** |
| **`aprovarOrcamento`/`recusarOrcamento`** | aprova / recusa→OS volta a diagnóstico | ❌ **falta UI (interno) + portal (M6)** |
| **`reabrirOrcamento`/`aprovarCq`** | renegociar / liberar gate CQ | ❌ **falta UI** |
| **`resolverContextoGate`** | lê orçamento+cq → `ContextoTransicao` real | 🔴 **EXISTE, TESTADO, NÃO LIGADO** (review #1) |

> 🔴 **O gate real não está conectado.** Hoje `acaoTransicionar` ([actions.ts:99](../src/app/os/actions.ts)) monta `{orcamentoAprovado:false, cqAprovado:false}` cravado → execução/pronta barram para sempre. **Ligar é o item 1 do M5** (§9).

---

## 6. Realtime ([infra/realtime/notificar.ts](../src/infra/realtime/notificar.ts)) — ADR-010
- Após cada mutação de OS, a composição chama `notificarPainel(tenantId)` → POST no endpoint de broadcast do Supabase (service key) no tópico `painel:{tenantId}`, payload vazio (ping). **Best-effort** (falha não quebra a mutação).
- O cliente ([realtime-painel.tsx](../src/app/_components/realtime-painel.tsx)) assina o tópico e dá `router.refresh()` no ping → refetch passa pela RLS. **O sinal viaja; o dado não.** Indicador ao vivo/reconectando.

---

## 7. Auth ([infra/auth](../src/infra/auth)) — ADR-006
- Supabase Auth, sessão por cookie (`@supabase/ssr`). `createSupabaseServer()` (Server Components/Actions) e `createSupabaseBrowser()` (client).
- `sessaoAtual()` ([sessao.ts](../src/infra/auth/sessao.ts)) → `{tenantId, usuarioId, papel}` ou null.
- Middleware ([supabase-middleware.ts](../src/infra/auth/supabase-middleware.ts)) protege rotas: não-auth→/login; admin sem AAL2→/login/2fa.
- 2FA TOTP (enroll/challenge/verify) em [login/2fa](../src/app/login/2fa).
- **RBAC** ([rbac.ts](../src/domain/auth/rbac.ts)): `pode(papel, acao)` / `assertPode(...)`; regra-chave "produção não edita orçamento".
  🔴 **Gap (review #2): nenhuma server action chama `assertPode`.** RBAC só existe no domínio, não no boundary. **Aplicar antes de expor a UI de orçamento.**

---

## 8. Convenções
- **TS strict, zero `any`.** Domínio puro (sem `import` de infra/framework).
- **Dinheiro em centavos inteiros**; **markup % inteiro**; nunca float para moeda.
- **Datas UTC/ISO 8601**; conversão por localidade na borda.
- **Testes (Definition of Done):** unidade (domínio), integração+RLS (casos de uso contra Postgres de teste), **isolamento multi-tenant obrigatório** (teste de vazamento). `pnpm test`, `fileParallelism:false` (DB serializa).
- **CI** (`.github/workflows/ci.yml`): build→lint→typecheck→test→checagem de migrations (db:generate não pode gerar diff). Sem merge com pipeline vermelho. **Sem Playwright.**
- **Migrations:** só Drizzle. Estrutural: `pnpm db:generate`. RLS: `drizzle-kit generate --custom --name rls_x` + escrever o SQL. **Nunca SQL manual em prod.**
- **Deploy:** `railway up --service igni-app --ci`; sempre commit/push no GitHub; migrar o cloud (`pnpm db:migrate` no `DATABASE_URL` cloud) antes do código que usa o schema novo.

---

## 9. Como ESTENDER (guia prático)

### 9.1 Ligar o gate real (item 1 do M5 — 🔴 review #1)
1. Em [composition/os.ts](../src/infra/composition/os.ts), `transicionarNoTenant` deixa de receber `contexto`; passa a:
   `const contexto = await resolverContextoGate(database, sessao, input.osId);` e chama `executarTransicao(database, sessao, {osId, para, contexto, motivo})`.
2. Em [actions.ts](../src/app/os/actions.ts), `acaoTransicionar` para de montar `{orcamentoAprovado:false…}`.
3. `executarTransicao` **continua** recebendo `ContextoTransicao` (preserva os testes unitários que injetam contexto).
4. Atualizar o comentário desatualizado (review #4) e adicionar teste: aprovado → execução libera; sem aprovação → barra.

### 9.2 Aplicar RBAC no boundary (🔴 review #2)
Em cada server action mutadora, após `sessaoAtual()`: `assertPode(sessao.papel, '<acao>')` e tratar `AutorizacaoNegadaError` como erro de retorno. Estender o mapa de `rbac.ts` para cobrir orçamento (produção = read-only) e triagem.

### 9.3 UI de orçamento (M5 — PRD F1)
1. **Composição:** adicionar wrappers em `composition/os.ts` (`montarOrcamentoNoTenant`, `enviarOrcamentoNoTenant`, `aprovarOrcamentoNoTenant`, `recusarOrcamentoNoTenant`, `reabrirOrcamentoNoTenant`, `aprovarCqNoTenant`) que injetam `database` + chamam `notificarPainel` no fim (padrão dos existentes).
2. **Queries de leitura:** `orcamentoDaOs(sessao, osId)` (status + itens + totais via `calcularOrcamento`).
3. **Server actions** em `src/app/os/[id]/` (RBAC + validação de input; reais→centavos).
4. **UI:** seção "Orçamento" no detalhe (client component, `useTransition`), com os **6 estados** (sucesso/vazio/loading/erro/permissão/overflow — PRD F1). Botão "Aprovar CQ" quando estado=controle_qualidade.

### 9.4 Portal público por token (M6 — ADR-012)
1. Rota `src/app/portal/[token]/page.tsx` (Server Component, **sem AppShell**, tema claro `--osso-50`, layout próprio).
2. **Resolução em 2 etapas:** (a) na conexão `db` privilegiada, **uma** query por `token_hash`=sha256(token) → `{os_id, tenant_id, token_expira_em, status}`; não achou/expirado → página de erro sem vazar. (b) com o `tenant_id`, todo o resto via `withTenant(tenant_id)` filtrando por `os_id`.
3. **Escrita:** casos de uso novos `aprovarPorToken`/`recusarPorToken` (reusam o núcleo, autorização por token; idempotentes se status≠enviado).
4. **LGPD (review #6):** mascarar placa/chassi no portal; helper de máscara. Realtime reusa `painel:{tenantId}`.
5. **Teste obrigatório:** token de um tenant **não** abre OS de outro (gate de CI).

---

## 10. Mapa de docs de produto (contexto)
[01 concepção](01_conception.md) · [05 branding](05_branding.md) · [07 PRD](07_prd.md) · [08 pesquisa](08_pesquisa_mercado.md) · [09 SDD](09_sdd.md) · [10 review](10_code_review.md) · [adr/](adr/) (001–012) · [status](00_status.md).
