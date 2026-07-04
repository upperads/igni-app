# Backlog de Produto — descobertas de campo (a planejar)

> Frentes de EVOLUÇÃO DO PRODUTO levantadas pelo dono em 01–02/07/2026, durante a varredura de
> qualidade. São maiores que polimento — cada uma merece planejamento próprio (`/produto` / `/prioriza`),
> não ser espremida numa fatia de correção. Registradas aqui pra não se perderem. **Entregues até aqui:
> P-0 (Quiosque + PIN), P-2 (Catálogo de preços) e P-1 (Cargos configuráveis). Próximo: P-3 (controle
> remoto de TV) e P-4 (financeiro).**

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

## P-3. Controle remoto do que cada TV mostra (chão ↔ escritório)
**A dor:** *"o chão tem vários setores, cada um com a TV exibindo a operação; o admin gerencia pelo
computador no escritório. Essa conexão remota existe?"*

**Estado atual (verificado):** o **realtime JÁ existe** (ADR-010, `notificarPainel` + broadcast por tenant):
quando o escritório muda algo, a TV do chão atualiza em <2s, e vice-versa. O `/chao` já filtra por etapa
(`?etapa=`) e por estação (`?por=estacao`). O que **falta** é o admin **controlar remotamente qual
setor/filtro cada TV específica mostra** (hoje cada TV é aberta manualmente na URL certa). Seria um
"gerenciador de telas": o escritório define, a TV obedece. Feature nova (registro de telas + push de config).

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

## Ordem sugerida (a validar com /prioriza)
- ✅ **P-0 (quiosque + PIN)** — NO AR (03/07).
- ✅ **P-2 (catálogo de preços)** — NO AR (03/07).
- ✅ **P-1 (cargos configuráveis)** — NO AR (04/07). Base pronta: define quem vê/faz o quê; destrava P-4.
1. **P-3 (controle remoto de TV)** — melhora a operação de chão; o realtime já dá a fundação. **← próximo**
2. **P-4 (financeiro)** — maior; os cargos (P-1) e os preços (P-2) já são a fundação.

> Método: cada uma entra por `/produto` (valida o problema) → `/prioriza` (ordem) → schema-first → fatias
> testadas, como todo o resto do Igni. Nada aqui é "só codar": são decisões de produto.
