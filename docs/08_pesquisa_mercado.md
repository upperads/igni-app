# Pesquisa de Mercado — Igni (validação do diferencial)

> Fase de pesquisa da cadeia de produto. Objetivo: confirmar/refutar/afiar o diferencial ANTES do SDD.
> Método: busca web + verificação cruzada (a /deep-research embutida falhou num passo interno de schema;
> a pesquisa foi refeita inline, com fontes citadas). Data: jun/2026. Mercado-alvo: Brasil.
> **Conclusão honesta em uma linha: quase todo "diferencial" que listamos JÁ EXISTE no mercado em peças
> separadas. O que ninguém entrega junto é uma POSTURA (honestidade do atraso com responsabilização) +
> SIMPLICIDADE de relance — e é aí que o Igni tem chão defensável, não nas features isoladas.**

---

## 1. O achado que muda o jogo (leia primeiro)

A hipótese do `01_conception.md` — "as opções existentes ou são genéricas ou pesadas e legadas" — é **parcialmente verdadeira, mas perigosamente otimista**. O líder vertical, **Certtus**, já tem praticamente tudo que tratávamos como nosso diferencial:

- **Kanban do fluxo do motor em tempo real no chão de fábrica**, com fases, prioridades (Urgente / Prazo de entrega) e **identificação de gargalo** — atualizado ao vivo no "painel de apontamento dentro da produção". [Certtus retífica](https://certtus.com.br/sistema-especifico-para-retifica-de-motores/)
- **Orçamento por seção** (Biela, Bloco, Cabeçote, Comando, Virabrequim), separando peças e serviços.
- **Robô de aprovação de orçamento via WhatsApp** + **avisos de evolução da OS** para o cliente.
- **Portal de acompanhamento para o cliente** com linha do tempo: datas, **tempo previsto vs. tempo real**, e o colaborador de cada tarefa. [Certtus Touch](https://play.google.com/store/apps/details?id=com.certtus.app&hl=pt)
- **Controle de tempo por código de barras** (tempo padrão vs. realizado, ociosidade) e **certificado de garantia**.

Traduzindo: **painel ao vivo, prioridade, gargalo, aprovação remota e portal do cliente NÃO são espaço em branco.** São tablestakes do incumbente — que, aliás, é "o sistema mais usado pelas retíficas brasileiras".

E no horizontal, o mesmo: KDS de restaurante já tem **bump, timer que muda de cor, auto-ordenação por urgência e som de alerta** ([Fresh KDS](https://www.fresh.technology/), [Lightspeed KDS](https://www.lightspeedhq.com/pos/restaurant/kitchen-display-system/)); auto-repair US (Tekmetric/ServiceTitan) já tem **inspeção digital com foto/vídeo → aprovação por link com assinatura, sem app** e **portal do cliente** ([Tekmetric DVI](https://www.tekmetric.com/feature/digital-vehicle-inspection), [Jobber Client Hub](https://www.fieldpulse.com/resources/blog/jobber-vs-servicetitan)).

**Onde a nossa narrativa estava ingênua:** vendíamos "tempo real + portal + aprovação por link" como inovação. Não é. Precisamos parar de competir onde o Certtus é forte e cravar onde ele é cego.

---

## 2. Panorama dos players

### Vertical (Brasil — concorrentes diretos)
| Player | OS/Fluxo | Prioridade | Atraso | Aprovação cliente | Portal cliente | Preço | Nota |
|---|---|---|---|---|---|---|---|
| **Certtus** | Kanban do motor por seção, tempo real no chão | Urgente / Prazo, gargalo visível | tempo previsto vs real | **Robô WhatsApp** | **Sim, com timeline** | sob consulta (não publica) | Líder do nicho; completo e já "pesado" |
| **Oficina Integrada** | OS completa, checklist | básica | — | OS+orçamento por WhatsApp/e-mail | — | **R$99–R$499/mês** (Bronze/Prata/Ouro) | Mass-market; reclamação de atendimento |
| **Wüst / WSoft** | OS digital, estoque, NFS-e | básica | — | **OS por WhatsApp, aprova no celular** | — | planos publicados | "Aprova no celular e começa na hora" |
| **Soften / AssistênciaPro / MotorSW** | OS, orçamento, financeiro | básica | — | aprovação digital WhatsApp/e-mail | — | variado | Genéricos de oficina |

Fontes: [Oficina Integrada planos](https://www.oficinaintegrada.com.br/software-gerencimento-oficina-mecanica/programa-gestao-oficina-mecanica-integrada/planos.asp), [Wüst](https://wust.dev.br/software-gestao-oficina-mecanica), [Motor SW](https://motorsw.com.br/).

### Horizontal (referências de outros setores)
| Categoria | Exemplos | O que fazem bem | O que NÃO trazem p/ retífica |
|---|---|---|---|
| **KDS** (cozinha) | Fresh KDS, Lightspeed, Oracle | bump, **timer que muda de cor**, auto-ordenação por urgência, alerta sonoro, roda em tablet barato | nada de orçamento/aprovação/cliente; serviço de minutos, não de dias |
| **Auto-repair US** | Tekmetric, Shop-Ware, ServiceTitan, Jobber | **inspeção digital foto/vídeo → aprovação por link com assinatura, sem app**; portal do cliente; tech board | foco em peça de prateleira/serviço rápido; não modela "sob encomenda" multi-estação de retífica |
| **Field service** | ServiceTitan, Jobber, Housecall Pro | **Client Hub** (aprovar orçamento, pagar, sem download), rastreio do técnico ao vivo | mundo de visita externa, não chão de oficina |

Fontes: [Tekmetric tech board](https://www.tekmetric.com/post/streamline-mechanic-work-orders-and-workflow-with-tekmetrics-tech-board), [ServiceTitan mobile](https://www.servicetitan.com/features/field-mobile-app), [Fresh KDS features](https://www.fresh.technology/blog/kitchen-display-system-features-you-need).

---

## 3. Matriz: commodity vs raro vs inédito

| Capacidade | Status no mercado | Veredicto p/ Igni |
|---|---|---|
| Painel/Kanban ao vivo no chão | **Commodity** (Certtus, KDS) | Tablestakes. Não é venda. |
| Prioridade/urgência na fila | **Commodity** (Certtus "Urgente/Prazo"; KDS auto-sort) | Tablestakes. |
| Cronômetro/cor por tempo | **Commodity** (KDS; Certtus tempo previsto×real) | Tablestakes. |
| Aprovação de orçamento por link/WhatsApp sem login | **Commodity** (Certtus robô, Wüst, Tekmetric, Jobber) | Tablestakes. **Nosso "portal sem login" NÃO é inovação.** |
| Portal de status p/ cliente | **Comum** (Certtus timeline, ServiceTitan/Jobber hub) | Tablestakes no líder; raro nos baratos. |
| **Razão crítica calculada** (prazo ÷ trabalho restante) como score | **Raro** — concorrentes usam prioridade manual/etiqueta, não um score derivado | **Diferencial fraco-a-médio**: é "mais inteligente", mas difícil de *vender* e fácil de copiar. |
| **Atraso com responsabilização explícita** (de quem é a bola: oficina/cliente/peça) | **Inédito no discurso** — ninguém *posiciona* "a culpa é nossa também" | **Diferencial forte** (de marca/postura, ver §4). |
| **Regra da vez** (travado por cliente cede a vez; por empresa mantém) | **Inédito** como regra de produto | Diferencial real, mas de nicho. |
| **Gates inegociáveis** que barram e dizem o motivo | **Raro** explicitado; muitos só "status" | Diferencial médio (disciplina de processo). |
| **Simplicidade radical de relance** ("a equipe de fato usa") | **Espaço em branco real** — a dor declarada do mercado é "complicado, ninguém usa" | **Diferencial forte** (ver §4). |
| Templates opinativos por ramo | Certtus já é multi-segmento | Paridade, não diferencial. |

---

## 4. Onde está o espaço em branco DEFENSÁVEL

Não está em nenhuma feature isolada. Está em **duas coisas que não se copiam com um sprint**:

### 4.1 Postura: "a honestidade do atraso, inclusive a nossa"
Todo concorrente trata atraso como *status neutro* ("em andamento", "aguardando peça"). **Ninguém posiciona a responsabilização** — dizer ao cliente, com calma, "atrasou, e a bola está com a gente" ou "faltou a peça que você ia mandar". 

**Validação cruzada (forte):** a realidade jurídica BR confirma que isso é um nervo exposto — tribunais responsabilizam a oficina pelo atraso **mesmo quando a peça do cliente atrasou**, porque "o veículo estava em sua posse" ([TJ/MG](http://www8.tjmg.jus.br/themis/baixaDocumento.do?tipo=1&numeroVerificador=100001904044830022022857268), [ConJur 2026](https://www.conjur.com.br/2026-jun-04/natureza-colaborativa-de-contrato-nao-afasta-culpa-de-prestadora-por-atraso/)). E "trabalhos mal-executados em oficinas lideram reclamações" ([Correio Braziliense, abr/2026](https://www.correiobraziliense.com.br/cidades-df/2026/04/7389080-trabalhos-mal-executados-em-oficinas-mecanicas-lideram-reclamacoes.html)).

⚠️ **Ajuste obrigatório de enquadramento:** a responsabilização NÃO é para a oficina *fugir da culpa* ("a culpa é do cliente"). Juridicamente isso não a exime. É **transparência que constrói confiança** — o cliente vê o estado real e para de ligar; e a oficina vê a própria dívida sem maquiar. Vender como "ferramenta de eximir culpa" seria um tiro no pé (e contra o CDC). Vender como "honestidade que mata a ligação de status" é ouro.

### 4.2 Simplicidade que a equipe de chão de fato usa
A dor nº1 declarada — "sistema complicado que a equipe não usa" — é **real e não resolvida** pelo líder. O Certtus é *completo*, e completo tende a *pesado*: 180+ recursos, código de barras, apontamento, financeiro, fiscal. Isso é exatamente o que faz a equipe não usar. **O Igni ganha sendo o oposto: dead-simple, relance na parede, mecânico de mão suja com luva.** É um diferencial de *menos*, não de *mais* — e é o mais difícil de um incumbente copiar (ele teria que se renegar).

> Nuance de evidência: a tese "ninguém usa" é dor de mercado bem documentada em geral ([scopi](https://scopi.com.br/blog/ferramenta-de-gestao-nao-funciona/)), mas **não temos review específico do Certtus** dizendo isso. É hipótese forte, não fato verificado. **Recomendação: validar com 3–5 entrevistas de retífica reais antes de cravar no pitch.**

---

## 5. Onde a nossa narrativa estava FRACA (corrigir)

| O que dizíamos | Realidade | Correção |
|---|---|---|
| "Painel ao vivo é diferencial" | Certtus e KDS já têm | Rebaixar a tablestake; não liderar o pitch com isso |
| "Aprovação por link sem login é inovação" | Commodity (Certtus/Tekmetric/Jobber) | Rebaixar; é higiene, não venda |
| "Portal do cliente é onde a marca nasce e é nova" | Certtus já tem portal com timeline | A marca nasce no **enquadramento** (responsabilização honesta), não na existência do portal |
| "Razão crítica é o cérebro diferencial" | Raro, mas fraco de vender e copiável | Manter como prova de inteligência, não como manchete |
| "Templates por ramo é diferencial" | Certtus já é multi-segmento | Paridade |

## 6. Onde estava FORTE (dobrar a aposta)
- **Responsabilização honesta do atraso** (com o enquadramento de transparência, não de eximir culpa). Único no discurso.
- **Simplicidade radical** ("teste do mecânico de mão suja"). O buraco que o líder não fecha sem se renegar.
- **"O atraso é a manchete"** como princípio de produto — ninguém mais coloca a má notícia em primeiro plano.

---

## 7. Recomendações concretas

### Ao PRD ([07_prd.md](07_prd.md))
1. **F2 (portal): mudar a métrica e o enquadramento.** O diferencial não é "portal existe" (Certtus tem) — é "o cliente vê de quem é a bola e a ligação de status some". Métrica-chave: **redução de ligações de status** (medir no piloto), não só "% de abertura".
2. **F2: adicionar regra anti-CDC.** O texto de responsabilização nunca afirma isenção legal da oficina; comunica estado, não culpa jurídica. Adicionar como regra de negócio explícita e revisar no `/auditoria-seguranca`/LGPD.
3. **Rebaixar no pitch (não no produto)** painel/aprovação-por-link de "diferencial" para "higiene competitiva". Mantêm-se no MVP (sem eles não há paridade), mas não lideram a comunicação.
4. **Subir a prioridade da SIMPLICIDADE como requisito mensurável.** Criar uma métrica de adoção de chão (ex.: % de OS movidas por bump na TV vs. por desktop) — é a prova viva do diferencial "a equipe usa".
5. **Considerar 1 feature de aprofundamento da honestidade** que o Certtus não tem: ex. **histórico de responsabilização** ("nos últimos 30 dias, 60% do atraso foi peça do cliente") — transforma a postura em dado de relacionamento. Avaliar no RICE.

### Ao branding ([05_branding.md](05_branding.md))
6. **O território "visibilidade honesta do chão" sobrevive — mas reposicionado:** não contra "ninguém tem visibilidade" (têm), e sim contra "**todo mundo maquia o status; nós contamos a verdade, inclusive a incômoda**". A inimiga não é a planilha; é o **status neutro que esconde de quem é a bola**.
7. **Naming (quando reabrir):** o nome tem que carregar honestidade/clareza, não "poder/gestão" — porque "gestão/ERP" é justamente o território saturado do Certtus.
8. **Pricing de marca:** o piso (R$99–R$499 da Oficina Integrada) é commodity barata; o Certtus é premium sob consulta. O Igni se posiciona como **"premium da simplicidade"** — não o mais barato, o que a equipe realmente usa.

---

## 8. Veredicto para a próxima fase (SDD)
O diferencial **não é técnico, é de produto/postura** — então o SDD não precisa de uma arquitetura exótica para "ganhar". Precisa servir, com excelência e simplicidade, duas coisas: (a) o **modelo de responsabilização** (já temos `culpaDoAtraso` no código — é nosso ativo único, dobrar nele) e (b) a **leveza de chão** (performance, relance, zero fricção). Seguir para `/arquitetura` com isso como norte, e marcar para validar a tese "ninguém usa o Certtus" com entrevistas reais antes do go-to-market.

### Riscos da pesquisa (transparência)
- Preço do Certtus não é público (não verificável).
- A tese de adoção fraca do líder é inferência de mercado, **não review específico** — validar com clientes.
- Fontes são páginas de fornecedor (viés de marketing) + jurídicas + comparativos; não houve entrevista primária.

---

## 9. Rodada 2 — ampliação (mais players + fontes independentes)

> Em resposta à cobrança "pesquisou só o Certtus?". Não — mas o Certtus dominou o holofote por ser
> o líder e a maior ameaça. A rodada 2 amplia o panorama e busca fontes independentes (reviews).
> **Dois achados mudam o peso de conclusões.**

### 9.1 Player landscape ampliado (vertical BR)
Além de Certtus/Oficina Integrada/Wüst/Soften/MotorSW, a rodada 2 confirmou um mercado **mais povoado** do que assumíamos:
- **Syscar** — "+2.500 oficinas usam e aprovam"; consulta SPC/Serasa, orçamento/OS enviados ao cliente. Base instalada relevante. [syscar.com.br](https://www.syscar.com.br/)
- **Wüst** — **R$79,90/mês** (o piso real do mercado), OS+NFS-e+financeiro+CRM; **"Painel do Mecânico" e "Portal do Cliente" são add-ons**. [wust.dev.br](https://wust.dev.br/melhor-sistema-para-oficina-mecanica)
- **Produttivo** — portal do cliente que tira o cliente do "preso no WhatsApp" + **mostra o que está no prazo ou atrasado**. [produttivo.com.br](https://www.produttivo.com.br/)
- **OnlineOS** — focado em OS/SLA e prazo. [onlineos.com.br](https://onlineos.com.br/ordem-de-servico-nao-concluida-no-prazo/)
- **Autopro, AlfaGest, WorkMotor** — citados em comparativos 2026 (AlfaGest se vende como "simplicidade, painel limpo"). [EV8 Auto](https://blog.ev8auto.com.br/post/sistema-para-oficina-mecanica-2026)
- Genéricos com módulo de oficina: Bling, Actana, GestãoClick.

**Implicação:** o mercado tem **dezenas** de players, do R$79,90 commodity ao Certtus premium. "Painel" e "portal do cliente" estão até no plano de R$79,90 (add-on). Competir em existência de feature é perder.

### 9.2 O CORE DIFERENCIAL CONFIRMADO como espaço em branco (achado mais importante)
Fui atrás especificamente de quem atribui **responsabilidade do atraso**. **Resultado: ninguém.**
- O **OnlineOS**, o player MAIS focado em atraso/SLA, **não atribui culpa** — rastreia status, SLA e "quem executou", mas (verificado, citação): *"Não há atribuição de culpa/responsabilidade pelo atraso... foca em monitoramento e controle de prazos, não em atribuição de responsabilidade."*
- Certtus/Produttivo mostram "no prazo / atrasado" — **status neutro**, nunca "de quem é a bola".

➡️ **A `culpaDoAtraso` do Igni (oficina/cliente/peça) é, até onde a pesquisa alcança, genuinamente inédita no mercado.** Nosso único ativo de produto realmente não-ocupado. Dobrar nele.

### 9.3 Fontes independentes: o mercado é REVIEW-THIN (corrige nossa tese)
Tentei Capterra/Reclame Aqui para provar "ninguém usa o líder". **Não há dado público suficiente:**
- **Certtus no Reclame Aqui: zero reclamações registradas** (sem selo, <10 avaliações). [Reclame Aqui](https://www.reclameaqui.com.br/empresa/certtus-sistemas-automotivos/)
- Capterra BR praticamente não tem reviews destes produtos com nota/queixa.
- Comparativos "independentes" são, na maioria, blogs de fornecedor (Wüst comparando a si mesmo, EV8 listando Autopro).

➡️ **Correção honesta de tese:** *não consigo PROVAR* "a equipe não usa o Certtus". A dor "sistema complicado que ninguém usa" é **anedótica/de mercado geral**, não documentada contra o líder. **Isso enfraquece o pitch "o líder é ruim".** O ângulo seguro não é atacar o Certtus — é **ocupar o que ele não posiciona** (responsabilização honesta) e a simplicidade como execução, validando a dór de adoção com **entrevistas primárias** (segue obrigatório).

### 9.4 Tamanho de mercado — VERIFICADO em fonte independente
O número do `01_conception.md` (~2.840 retíficas) **bate com fonte independente**: ~**2.840 retíficas ativas**, **1.170 empresas** no CNAE, projeção de **6,1 milhões de motores/ano**, oficinas processando **2 a 24 motores/dia**; concentração SP/Goiânia/RJ. [Revista Reparação Automotiva (out/2025)](https://reparacaoautomotiva.com.br/2025/10/27/mercado-valorizado-de-retificas-de-motores-automotivos-no-brasil/), [Econodata](https://www.econodata.com.br/empresas/todo-brasil/recondicionamento-e-recuperacao-de-motores-para-veiculos-automotores-c-2950600). TAM pequeno e concentrado — favorece GTM por comunidade/associação (ABRACO), não mídia paga.

### 9.5 O que a rodada 2 muda nas recomendações
1. **Não construir o pitch contra "o Certtus é ruim"** (não provável). Construir contra "**o status neutro que ninguém responsabiliza**".
2. **Pricing**: piso real é R$79,90 (Wüst), não R$99. O Igni não disputa preço — disputa "a equipe usa + honestidade". Posicionar acima do piso commodity.
3. **TAM pequeno (~2.840 + centros automotivos)** reforça: foco em nicho mal-servido (pesado/agro), GTM por associação, e **dogfooding** na própria retífica como prova.
4. **Validação primária é não-negociável** antes do go-to-market: 3–5 entrevistas de retífica para confirmar a dor de adoção (a pesquisa pública não confirma).
