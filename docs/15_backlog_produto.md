# Backlog de Produto — descobertas de campo (a planejar)

> Frentes de EVOLUÇÃO DO PRODUTO levantadas pelo dono em 01–02/07/2026, durante a varredura de
> qualidade. São maiores que polimento — cada uma merece planejamento próprio (`/produto` / `/prioriza`),
> não ser espremida numa fatia de correção. Registradas aqui pra não se perderem. **Entregues até aqui:
> P-0 (Quiosque + PIN), P-2 (Catálogo de preços), P-1 (Cargos configuráveis) e P-3 (Controle remoto de
> TV). Próximo: P-4 (Módulo Financeiro).**

## P-1. ✅ NO AR (04/07/2026) — Cargos configuráveis por tenant
**A dor (nas palavras do dono):** *"por que a equipe teria senha se eles vão ter a TV pra acompanhar?"* +
*"precisa pôr a nomenclatura correta das funções da equipe: Produção, Financeiro, Compras, Pós-venda…"*

**Entregue:** os 4 papéis fixos viraram **cargos configuráveis por tenant** — nome livre + permissões de um
**catálogo fixo** de 10 chaves que o código sabe fazer valer. Cada tenant nasce com **7 cargos-semente**
(Dono, Gestor, Recepção, Produção + os novos **Financeiro**, **Peças/Compras**, **Pós-venda**). Tela
**`/config/cargos`** (gate exclusivo do Dono) com matriz de permissões e os 4 pisos ao vivo. A Equipe passa a
atribuir cargo (não papel). O RBAC opera sobre as permissões do cargo (o enum `papel` virou legado tolerado).
Desenho validado por pesquisa de mercado (Tekmetric/GestãoClick/vhsys + padrão RBAC de GitHub/Slack/Stripe).

**Os 4 pisos de segurança (invariantes testados):** (1) cargo Dono imutável — nome travado, não editável/
excluível — + sempre ≥1 Dono ativo (trava do último Dono); (2) cargo de chão NÃO vê dinheiro nem edita
orçamento (regra de ouro travada); (3) 2FA é piso nunca teto — permissão-gatilho força 2FA no servidor,
`dinheiro:ver` não dispara (recepção segue sem 2FA); (4) isolamento por tenant absoluto (RLS, migrations
0022–0024, testado A↔B + teste da ligação do seed com dados pré-existentes). `cargo:gerir` é exclusivo do
Dono (fora do catálogo atribuível) → sem auto-escalonamento; barrado também no servidor. Onboarding semeia
os cargos para tenants novos. Spec/plano: `docs/superpowers/specs/2026-07-03-cargos-configuraveis-design.md`.

**Fica para fatias futuras:** esconder valores na LEITURA por `dinheiro:ver` (hoje o gate só controla editar);
escopo de dados por cargo ("ver só as OS próprias"); slot de PIN para cargos de chão customizados; remoção
do enum `papel`. Os módulos que dão poder pleno aos cargos novos (Financeiro=P-4, peças/compras, pós-venda)
chegam com suas telas.

## P-2. ✅ NO AR (03/07/2026) — Catálogo de serviços com preço
**A dor:** *"o Igni não tem precificação, adição de serviços já pré-definidos etc., tem que colocar sempre
manualmente na OS."*

**Entregue:** um **catálogo de serviços por tenant** (tabela `servico`: nome, tipo `peca/mao_de_obra/terceiro`,
`valor_centavos`, `markup_pct` padrão, `ativo`), gerido em **`/servicos`** (CRUD agrupado por tipo, RBAC
`orcamento:editar` = dono/gestor/recepção) com **reajuste em massa** dos ativos (+/−X%, faixa −90 a +200,
com confirmação). No builder de orçamento, o botão **"Do catálogo"** abre um seletor e **preenche uma linha
editável** — o preço do catálogo é **sugestão**: copia pra linha e pode divergir naquela OS (sem FK,
`montarOrcamento` intocado). Isolamento multi-tenant por RLS (migrations 0020/0021), testado A↔B. Dinheiro
sempre em centavos inteiros; `reaisParaCentavos` é fonte única no domínio. Spec/plano:
`docs/superpowers/specs/2026-07-03-catalogo-servicos-preco-design.md` + `docs/superpowers/plans/2026-07-03-*`.
**Fica para fatias futuras:** histórico de preço, importar planilha, preço por cliente, contagem "N serviços
afetados" antes de confirmar o reajuste, validação da faixa do pct no cliente (hoje só no servidor).

## P-3. ✅ NO AR (05/07/2026) — Controle remoto do que cada TV mostra
**A dor:** *"o chão tem vários setores, cada um com a TV exibindo a operação; o admin gerencia pelo
computador no escritório. Essa conexão remota existe?"*

**Entregue:** cada TV vira um **dispositivo de tela** com token forte (molde do quiosque P-0), na rota
pública **`/tv/[token]`** (sem senha, read-only). O escritório registra as TVs em **`/config/telas`**
(gate `config:editar`, QR + código curto mostrados 1×), controla remotamente **o que cada uma mostra**
— uma estação (`modo=estacao`) ou a visão geral (`modo=geral`) — e a TV **obedece em <2s** pelo realtime
que já existia (`configurarTela` → `notificarPainel` → a TV relê a própria config). Pareamento por
`/tv/entrar` (digita o código). Tabela `tela` por tenant com RLS (migrations 0025/0026), resolução por
token **privilegiada** (o tenant vem só do registro, nunca do input — sem vazamento). **Escopo mínimo:**
a TV só exibe o painel (código da OS + tipo do equipamento + responsável + sinal), nunca placa/chassi/
cliente/dinheiro, nenhuma ação. A `/painel/tv` logada continua existindo. Review final (opus) verificou os
2 riscos Critical de rota pública multi-tenant (isolamento + PII) — ambos fechados. Spec/plano:
`docs/superpowers/specs/2026-07-04-controle-remoto-tv-design.md` + `docs/superpowers/plans/2026-07-04-*`.

**Fica para fatias futuras:** filtro por etapa numa tela; título/tema custom; múltiplas estações por TV;
rotação automática entre setores; heartbeat/uptime das TVs. **Segurança (follow-up conjunto):** endurecer
o "código curto na URL" em `/quiosque` E `/tv` juntos (código vira credencial de pareamento com TTL,
trocada server-side pelo token pleno) — hoje é o mesmo trade-off do quiosque auditado, mitigado por
rate-limit por IP + só resolver tela ativa.

## P-0. ✅ NO AR (03/07/2026) — Quiosque de Setor + PIN
**Entregue:** o tablet do box fica logado NO SETOR por um **token forte** (sha256, gerado pelo admin nas
Estações via QR + código curto de backup); a equipe avança a OS (`/quiosque/[token]`, cards grandes, 1
toque) e digita um **PIN de 4 dígitos individual** (HMAC-SHA256) que CARIMBA quem avançou — sem senha o
dia todo, sem perder o "quem". Escopo mínimo (só avança OS do próprio setor; sem preço/orçamento/
financeiro/cliente). Isolamento multi-tenant por RLS, rate-limit anti-brute-force nas 3 superfícies.
Admin define o PIN na Equipe e revoga o quiosque nas Estações. Spec: `docs/superpowers/specs/2026-07-02-*`.
**Fica para uma fatia futura (fecha o "PODE" do spec):** travar/destravar pelo quiosque; e explicar o
modelo de hardware (TV na parede + tablet no box + PC no escritório) no onboarding/primeiros-passos.

## P-0 (histórico). ⭐ Modelo de hardware/dispositivo do chão + login do setor (o furo que o dono achou)
**A dor (nas palavras do dono):** *"como a equipe vai dar o bump numa TV? Teria que ter um PC pra cada
box/setor?!"* — e antes: *"por que a equipe teria senha se vão ter a TV pra acompanhar?"*

**O problema real (conceitual, não bug):** o Igni tem TRÊS dispositivos com papéis diferentes e **isso
nunca foi explicado no produto**:
- **TV na parede** = só EXIBE a fila do setor (`/painel/tv`, read-only). Como painel de senha de lotérica.
- **Tablet/celular no box** = onde o produtivo TOCA o bump (`/chao`, botão gigante, 1 toque, luva).
- **PC do escritório** = app completo (recepção/gestão).

A resposta à pergunta do dono: **NÃO precisa PC por box — precisa um tablet Android baratinho por setor**
(ou o celular do produtivo). O `/chao` foi feito pra isso. Mas o produto **nunca diz isso** — nem no
onboarding, nem no "Primeiros passos". Um dono olhando hoje tem exatamente a dúvida do dono. É um furo de
comunicação/onboarding que pode custar adoção.

**A oportunidade (2 frentes):**
1. **Explicar o modelo de hardware** no onboarding/primeiros-passos (TV na parede + tablet no box + PC no
   escritório) — com sugestão de aparelhos baratos. Baixo esforço, alto impacto na adoção.
2. **Login por SETOR, não por pessoa, no tablet do chão** (a decidir): o tablet do box fica num modo
   quiosque logado NO SETOR — qualquer um do box toca sem senha individual. O que importa é "o setor X
   avançou", não "o João avançou". Isso ataca DIRETO o furo de adoção que a pesquisa (voz_do_mercado §H1)
   diz ser o que mata ou salva o produto: *"a equipe de chão não abre o sistema"*. Se não tem senha nem
   login pessoal, a barreira de adoção despenca. **Conecta com P-1 (papéis):** talvez `producao` deixe de
   ser um login de pessoa e vire um "dispositivo de setor".

**Por que é P-0:** é a descoberta mais barata-e-impactante da conversa, e ataca o risco nº1 do produto
(adoção do chão). Deve vir ANTES das outras — inclusive porque muda como se pensa os papéis (P-1).

## P-4. Módulo Financeiro
**A dor:** o dono mencionou o financeiro como *"ainda não implementado"* — e como o motivo real de alguns
papéis precisarem de login (não é o chão que precisa de financeiro, é a gestão).

**Estado atual:** não existe. O Canvas (`01_conception.md`) já previa "financeiro por OS" na Onda 2.

**A oportunidade:** contas a receber por OS, fluxo do orçamento aprovado → cobrança, relatório financeiro.
Grande; provavelmente depois de P-1 (papéis) e P-2 (preços), que são pré-requisitos naturais.

---

## Descobertas de campo — reunião de teste na oficina (05-06/07/2026)
> O dono e a equipe abriram OS de verdade no Igni e narraram o que faltava. Confirmaram: **triagem×OS
> era redundante** (já fundido), **navegação lenta** (já corrigida) e **modo TV = visão de corredor** (P-3).
> Itens novos abaixo, por tipo. Ordem de ataque definida com o dono: **F (bug) e A (setores) primeiro.**

### P-5. Modelo de SETOR agrupando estações [item A] — decomposto em P-5a/b/c
**A dor (nas palavras do dono):** a oficina real **não tem uma TV por estação**. Tem **~4-5 SETORES
físicos**, cada um agrupando várias estações (Usinagem, Bomba e bico, Desmontagem+lavagem, Montagem, Pátio).

- **P-5a ✅ NO AR (06/07/2026)** — nível **setor** agrupando `estacao` (dois níveis). Migração sem quebrar
  (1 setor por estação existente + liga; verificado no cloud: **0 estações órfãs**, 30/30 ligadas). Template
  do ramo vira setores→estações; `criar-oficina` semeia. Tela **`/config/setores`** (grupos + estações
  aninhadas + mover estação; apagar setor bloqueia se tem estações). A **TV mostra um setor inteiro**
  (`modo=setor` filtra pelas estações do setor). `os.estacaoId` intocado (setor derivado). Isolamento RLS
  testado A↔B (migrations 0028–0031). Spec/plano: `docs/superpowers/*2026-07-06-setor-*`.
- **P-5b (futura)** — quiosque por setor (o tablet do chão loga no setor, não na estação).
- **P-5c (futura)** — card do painel/TV com o **setor responsável** na execução (item I da reunião).
- Follow-up cosmético: título da TV em `modo=setor` mostra "Setor" genérico (o nome do setor não chega ao
  `DadosTv`) — fatia curta futura.

### Refinos de coisas no ar
- **[C] Catálogo no orçamento com Enter inteligente** (refina P-2): digitar "mão de obra de plainar" + Enter
  abre tudo de plainar; digita a peça → entende que é peça. Sem selecionar tipo à mão. Navegação por Enter/Tab.
- **[D] Quantidade no item do orçamento** (refina P-2): "retífica de biela = R$110, **4 unidades**". Hoje só
  há valor, não quantidade. O markup por % confundiu ("não por porcentagem") — repensar a UI de valor×qtd×markup.
- **[H] Card do modo TV com FUNDO colorido por prioridade** (refina P-3): o card inteiro com o tom (verde/
  amarelo/vermelho), estilo painel de senha/UPA, pra bater o olho de longe. Hoje é só a faixa lateral.
- **[I] Setor responsável no card da TV** (refina P-3): na execução, o card mostra **qual setor está com a
  bola** ("setor de usinagem") pra a pessoa do setor saber que é dela.

### Bug a investigar
- **[F] Card preso em "aguardando aprovação" depois de aprovar o orçamento.** Na reunião, aprovaram o
  orçamento mas o card continuou parecendo travado/aguardando decisão do cliente. Investigar o fluxo
  aprovação→execução (pode ser bug real, ou UX de "o que fazer a seguir" não óbvia).

### Features novas
- **[B] Fluxo de cadastro guiado ao abrir OS**: em etapas (cliente → veículo → serviço → orçamento),
  passando de campo em campo com Enter/Tab, em vez de clicar botão por botão. O cliente **fica na base** ao
  abrir a OS (não cadastra separado). "Eu travei nisso" — a organização do fluxo é a dor central do dono.
- **[E] Placa → puxa dados do veículo (API tipo Denatran)**: digita a placa, traz ano/modelo/cor. "API e é
  baratinho." Integração externa — avaliar custo/parceiro.
- **[G] Editar orçamento depois de aprovado**: hoje só há "desfazer" (que desfaz o último item, gerou
  dúvida). Falta um **"editar orçamento"** sem apagar tudo. Liga com o P-4a (conta a receber acompanha).
- **[J] Aviso visual "salvo"**: pop-up/toast de confirmação a cada salvamento.

### Confirmações (sem ação)
- **[K] Nota fiscal via API "quando ficar caro, paga por ano"** — o dono confirma: fiscal é **Onda 3/futuro**,
  fora do P-4. Reforça a fronteira que já desenhamos no financeiro.

---

## Ordem sugerida (a validar com /prioriza)
- ✅ **P-0 (quiosque + PIN)** — NO AR (03/07).
- ✅ **P-2 (catálogo de preços)** — NO AR (03/07).
- ✅ **P-1 (cargos configuráveis)** — NO AR (04/07). Base pronta: define quem vê/faz o quê; destrava P-4.
- ✅ **P-3 (controle remoto de TV)** — NO AR (05/07). Fecha a operação de chão remota.
- ✅ **Aprimoramentos (perf navegação + Kanban TV + funde triagem/os)** — NO AR (05/07).
- ✅ **[F] Bug do card "aguardando aprovação"** — corrigido e NO AR (05/07).
- ✅ **P-5a (setor agrupando estações + TV por setor)** — NO AR (06/07).
- ✅ **P-4a (conta a receber por OS)** — NO AR (06/07). Nasce no orçamento aprovado com o total; linha do tempo própria (aberta/recebida/cancelada); aberta acompanha, recebida congela, cancelada reabre. Bloco Financeiro no detalhe da OS. Permissão nova `financeiro:gerir` (só gestão/financeiro cancela cobrança; verificado no cloud: Dono/Gestor/Financeiro sim, Recepção não). Tabela `conta_receber` RLS 0032–0034. Spec/plano: `docs/superpowers/*2026-07-06-conta-receber-*`.
- ✅ **P-4b (registrar pagamento/baixa)** — NO AR (07/07). Baixa **total** (`aberta`→`recebida`) com **forma de pagamento** (dinheiro/pix/cartão débito/cartão crédito/transferência/boleto) e **data** (=agora), mais **desfazer** (`recebida`→`aberta`, limpa forma/data). No bloco Financeiro: "Registrar recebimento" (seletor de forma) e "Desfazer recebimento" (confirmação inline); tudo gated por `financeiro:gerir`. `aprovarOrcamento` intocado — o congelamento automático da conta recebida permanece; só o desfazer manual reabre. 2 colunas na `conta_receber` (`forma_pagamento`/`recebido_em`, nullable) + enum `forma_pagamento`, migration 0035. SEM parcial/fiscal/gateway. Spec/plano: `docs/superpowers/*2026-07-06-registrar-pagamento-p4b*`.
1. **P-4c (relatório financeiro)** — quanto entrou no período (usa `recebido_em`+`forma_pagamento` da P-4b), em aberto, atraso. **← próximo do financeiro**
3. **P-5b/P-5c** — quiosque por setor; card com setor responsável (item I).
4. Refinos e features novas [B,C,D,E,G,H,I,J] — priorizar com o dono.

> Método: cada uma entra por `/produto` (valida o problema) → `/prioriza` (ordem) → schema-first → fatias
> testadas, como todo o resto do Igni. Nada aqui é "só codar": são decisões de produto.
