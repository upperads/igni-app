# P-3 — Controle remoto do que cada TV mostra (chão ↔ escritório)

> Design validado com o dono em 04/07/2026 (brainstorm). Backlog de produto: `docs/15_backlog_produto.md` (P-3).
> App EM PRODUÇÃO (Next.js + Supabase + Drizzle + RLS por tenant). Schema-first, uma fatia por vez.

## O problema (nas palavras do dono)

*"O chão tem vários setores, cada um com a TV exibindo a operação; o admin gerencia pelo computador no escritório. Essa conexão remota existe?"* — o dono quer, **do escritório, controlar qual setor cada TV específica mostra**, sem ir até a TV mudar a URL.

## O que já existe (verificado)

- **Realtime** (ADR-010): `notificarPainel(tenantId)` publica um ping no tópico `painel:{tenantId}` (evento `mudou`); o cliente `RealtimePainel` assina e dá `router.refresh()` (alvo <2s). O sinal viaja; os dados vêm do refetch pela RLS.
- **Modo TV** (`/painel/tv`): board read-only, tela cheia, **logado** (usa `sessaoAtual`), mostra tudo. Reusa RiskRail, OsCard, Relógio, a faixa de responsabilização do atraso.
- **`/chao`** filtra por etapa (`?etapa=`) e por estação (`?por=estacao`).
- **Quiosque de setor** (P-0): o padrão de **token de dispositivo** — `token_hash` (sha256 de 32 bytes), `codigo_curto` de pareamento, `revogado_em`, rota pública (o token é a credencial, sem sessão). Auditado.
- **Cargos** (P-1, no ar): `config:editar` (Dono/Gestor) gerencia estações/quiosque/templates.

## O que falta (o alvo desta leva)

Um **"gerenciador de telas"**: registrar cada TV como um dispositivo (token, como o quiosque) e o escritório **empurrar remotamente** o que cada TV mostra. Hoje cada TV é aberta manualmente na URL certa e exige login; o P-3 dá identidade por-TV e controle remoto.

---

## Arquitetura

Cada TV vira um **dispositivo de tela** registrado, espelhando o quiosque: fica logado num token para sempre (sem senha), e o escritório controla remotamente o que ela mostra. A config **é** uma linha no banco; o realtime que já existe avisa a TV para reler.

**Fluxo:** o escritório troca o `modo`/`estacao_id` de uma tela (UPDATE) → dispara `notificarPainel(tenantId)` (o ping existente) → toda TV assinante refaz a leitura; cada TV lê a **própria** config pelo seu token e re-renderiza com o novo filtro. O sinal viaja pelo canal; a config e os dados vêm do refetch (RLS) — mesmo princípio do ADR-010.

### Tabela `tela` (por tenant, molde do `quiosque_setor`)

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL → tenant (cascade) | RLS por tenant (regra de ouro #7) |
| `nome` | text NOT NULL | rótulo da TV ("TV Bloco", "Corredor") |
| `modo` | enum `modo_tela` (`estacao` \| `geral`) NOT NULL | o que a tela exibe |
| `estacao_id` | uuid → estacao (set null) | preenchido só quando `modo=estacao`; nulo em `geral` |
| `token_hash` | text NOT NULL unique | sha256 do token de 32 bytes (só o hash mora aqui) |
| `codigo_curto` | text NOT NULL unique | atalho de pareamento (troca-se pelo token) |
| `criado_por` | uuid → usuario (set null) | quem registrou |
| `revogado_em` | timestamptz | revogação manual (o controle do dispositivo) |
| `ultimo_uso_em` | timestamptz | última vez que a TV carregou |
| `created_at` | timestamptz NOT NULL default now | |

- RLS na mesma migration: GRANT app_user + ENABLE (sem FORCE) + policy `tela_tenant_isolation` USING/WITH CHECK por `app.current_tenant` — mesmo formato de `0023_rls_cargo.sql`.
- Novo enum `modo_tela` (`estacao`, `geral`) em `schema/enums.ts`, espelhado no domínio (teste de drift, como os outros enums).

**Invariante de dados (domínio `validarTela`):** `modo=estacao` exige `estacao_id` preenchido; `modo=geral` exige `estacao_id` nulo. `nome` não vazio. Rejeita com `DadosInvalidosError` — mesmo padrão de `validarCargo`.

### Token e código curto (reusa o padrão do quiosque)

- `hashToken(token)` = sha256 puro (token de 32 bytes = alta entropia; padrão do quiosque/portal). **A tela NÃO tem PIN** (ela só exibe; não avança OS, não carimba autoria).
- Token = `randomBytes(32).toString("base64url")`, devolvido **cru uma única vez** no registro (para o QR); só o hash fica no banco.
- `codigo_curto` = `gerarCodigoCurto(nome, sufixo)` com retry na colisão do UNIQUE (como `gerarQuiosque`).

## Rota pública `/tv/[token]`

Pública (entra em `ROTAS_LIVRES` do middleware, junto de `/portal` e `/quiosque`) — sem sessão, sem login. O token é a credencial.

Ao carregar:
1. **Resolve a tela por token — etapa PRIVILEGIADA mínima** (espelha `resolverQuiosque`): o lookup por `token_hash` atravessa tenants, então roda na conexão privilegiada (`database.db`, fora de `withTenant`) buscando `where(token_hash = hashToken(token))`. O `tenant_id`, `modo` e `estacao_id` vêm do REGISTRO, nunca do input. Se não existe ou `revogado_em` preenchido → `null` → tela "Esta tela foi desconectada. Fale com o escritório." (não vaza nada). Esta é a única leitura privilegiada; ela lê só a linha da própria tela.
2. Com o `tenant_id` resolvido, carrega o painel filtrado **escopado ao tenant DA TELA** via `withTenant(tela.tenantId)` (a RLS volta a valer para a leitura das OS), com o filtro derivado da config (`modo`/`estacao_id`) — não de uma sessão de usuário.
3. Renderiza o board **read-only, tela cheia** reusando o visual do `/painel/tv` (RiskRail, cards grandes, relógio, faixa de responsabilização): `modo=estacao` mostra só a estação (como `?por=estacao`); `modo=geral` mostra tudo.
4. Carimba `ultimo_uso_em`.
5. Assina o realtime do tenant (o `RealtimePainel` existente) → a cada ping, `router.refresh()` relê config + dados.

**Escopo mínimo (segurança, espelha o quiosque):** a TV **só exibe o painel**. Nunca avança OS, nunca vê dinheiro/orçamento/cliente/placa, nunca navega para outra rota. Vitrine read-only. O token dá acesso apenas à leitura do painel daquele tenant, filtrado pela config da tela.

**Resiliência (RNF-DISP-01):** se o realtime cair, a última tela permanece e reconecta sozinho (como o painel hoje). Token revogado com a TV no ar → o próximo refresh mostra "desconectada".

**Pareamento** (`/tv`, rota pública): abre-se na TV, digita-se o código curto → troca pelo token → redireciona para `/tv/[token]`. Ou escaneia o QR. Idêntico ao quiosque.

> A `/painel/tv` logada **continua existindo** (para ver o painel cheio no próprio PC pelo login). A `/tv/[token]` é a versão-dispositivo, controlável. Não removo a antiga (zero regressão).

## Tela de gestão `/config/telas`

Nova; gate `config:editar` (Dono/Gestor), ao lado de Estações/Equipe/Cargos na nav de config.

- **Lista as TVs**: nome, o que mostra agora (a estação ou "Visão geral"), status (ativa/revogada), último uso.
- **Registrar TV**: nome + modo (estação → seleciona qual; ou visão geral). Ao criar, mostra **QR + código curto** uma única vez (o token cru não é reexibido). Espelha o fluxo do quiosque.
- **Trocar o que a TV mostra** (o coração do P-3): mudar modo/estação ali → salva → dispara o ping → a TV obedece em <2s, sem ninguém ir até ela.
- **Revogar**: preenche `revogado_em`; a TV mostra "desconectada" no próximo refresh.

**RBAC:** todas as actions de `/config/telas` passam pelo gate `config:editar` no boundary (como estações/cargos). A rota pública `/tv/[token]` não tem RBAC de usuário — o token é a credencial de escopo mínimo.

## Fatiamento (schema-first, cada fatia testável e deployável)

1. **Schema + RLS + domínio** — enum `modo_tela`, tabela `tela` + RLS `tela_tenant_isolation` (migration), teste de isolamento A↔B. Domínio: `validarTela` (invariante modo↔estacao_id), reuso de `hashToken`/`gerarCodigoCurto`. *(fixa o modelo)*
2. **Aplicação + composição** — `listarTelas`, `registrarTela` (gera token, retorna o cru uma vez), `configurarTela` (troca modo/estação + dispara `notificarPainel`), `revogarTela` (todas escopadas por `withTenant`), e `resolverTelaPorToken` (etapa privilegiada mínima: lookup por `token_hash` fora de `withTenant`, retorna `{tenantId, modo, estacaoId}` do registro; null se revogada/inexistente). Teste de isolamento + o invariante + token revogado não resolve.
3. **Rota pública `/tv/[token]` + pareamento `/tv`** — resolve por token (sha256), board read-only filtrado (reusa o visual do `/painel/tv` + filtro por estação), carimba `ultimo_uso_em`, assina realtime. Pareamento por código curto. Ambas em `ROTAS_LIVRES`. Tela "desconectada" para token inválido/revogado.
4. **Tela de gestão `/config/telas`** — CRUD (registrar com QR/código, trocar o que mostra, revogar) + nav. RBAC `config:editar` no boundary. O "trocar o que mostra" dispara o ping.
5. **Pipeline + deploy** — CI verde, migration cloud via `railway run`, `railway up`, smoke (`/login` 200, `/config/telas` 307→login, `/tv/token-invalido` mostra desconectada).

Cada fatia testável isoladamente; teste de isolamento explícito onde toca dados (fatias 1 e 2).

## Fora de escopo (follow-ups)

- Filtro por **etapa** numa tela (só estação/geral nesta leva).
- Título/tema custom por tela além do `nome`.
- Múltiplas estações numa TV; rotação automática entre setores.
- Métricas de uptime/heartbeat das TVs (temos só `ultimo_uso_em`).
- Aposentar a `/painel/tv` logada.

## Testes (Definition of Done)

- **Unidade**: `validarTela` (modo=estacao exige estacao_id; modo=geral exige nulo; nome vazio rejeitado), drift enum `modo_tela` × domínio.
- **Integração**: rotas de tela + DB com **teste de isolamento multi-tenant A↔B** (fatias 1 e 2); `resolverTelaPorToken` só resolve tela ativa do tenant certo; token revogado não resolve.
- **Comportamento**: `configurarTela` dispara `notificarPainel` (o push); a rota pública renderiza filtrado por `modo`.
