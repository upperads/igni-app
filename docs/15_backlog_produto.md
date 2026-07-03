# Backlog de Produto — descobertas de campo (a planejar)

> Frentes de EVOLUÇÃO DO PRODUTO levantadas pelo dono em 01–02/07/2026, durante a varredura de
> qualidade. São maiores que polimento — cada uma merece planejamento próprio (`/produto` / `/prioriza`),
> não ser espremida numa fatia de correção. Registradas aqui pra não se perderem. **Nada implementado
> ainda; a varredura de qualidade seguiu separada.**

## P-1. Nomenclatura e estrutura de setores/papéis
**A dor (nas palavras do dono):** *"por que a equipe teria senha se eles vão ter a TV pra acompanhar?"* +
*"precisa pôr a nomenclatura correta das funções da equipe: Produção, Financeiro, Compras, Pós-venda…"*

**Estado atual (verificado no código):** os papéis são `dono / gestor / recepcao / producao` (`domain/auth/papel.ts`).
- `producao` = equipe do chão; loga **para dar o bump** (avançar OS no `/chao`, 1 toque) — é o que gera a
  métrica de adoção do chão. Não é "só assistir a TV": eles TOCAM o fluxo.
- A confusão é legítima: a nomenclatura é genérica e não reflete a estrutura real de uma retífica.

**A oportunidade:** modelar os **setores reais** (Produção, Financeiro, Compras, Pós-venda…) e o que cada
um faz/vê. Isso destrava features que hoje não existem (financeiro, compras). Decisão de arquitetura de
papéis — precisa de `/produto` antes de código. Conecta com o RBAC existente (`rbac.ts`).

## P-2. Catálogo de serviços com preço (parar de digitar tudo manual)
**A dor:** *"o Igni não tem precificação, adição de serviços já pré-definidos etc., tem que colocar sempre
manualmente na OS."*

**Estado atual:** todo item de orçamento é digitado à mão (`orcamento.tsx`, `montarOrcamento`). Não há
catálogo.

**A oportunidade:** um **catálogo de serviços por tenant** (ex.: "retífica de cabeçote = R$X", "plaina = R$Y",
"teste de trinca = R$Z") que a recepção **seleciona** em vez de digitar. Ganho enorme de velocidade e
**padronização de preço**. Schema novo (tabela `servico` por tenant) + UI de gestão do catálogo + seleção
no builder de orçamento. Feature de produto de verdade.

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
1. **P-1 (papéis/setores)** — é base: define quem vê/faz o quê, e destrava P-4.
2. **P-2 (catálogo de preços)** — alto valor imediato, dor concreta do dia a dia, escopo médio.
3. **P-3 (controle remoto de TV)** — melhora a operação de chão; o realtime já dá a fundação.
4. **P-4 (financeiro)** — maior, depende de P-1/P-2.

> Método: cada uma entra por `/produto` (valida o problema) → `/prioriza` (ordem) → schema-first → fatias
> testadas, como todo o resto do Igni. Nada aqui é "só codar": são decisões de produto.
