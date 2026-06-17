# Definição — PRONTO (codinome)

> Fase 2. O **o quê** e as **regras**. PRD com foco no usuário/negócio; SRS com foco em
> engenharia. Tudo derivado da Fase 1 e do briefing operacional.
>
> Etiquetas de evidência (UX): **[FATO]** está no briefing/docs · **[INFERÊNCIA]** deduzido
> da fonte · **[DECISÃO]** recomendação de design/produto · **[AMBIGUIDADE]** fonte omissa.

---

# PRD

## Personas

### P1 — Dono/Gestor da oficina (comprador + visão gerencial)
- **Contexto** [FATO]: toca a operação, sofre com desorganização, sem visão de atraso nem
  de margem por OS. Decide a compra junto com o sócio.
- **Dores** [FATO]: serviço órfão, atraso (queixa do cliente), falta de controle.
- **Maturidade** [INFERÊNCIA]: média; usa WhatsApp e sistema atual, mas não é técnico.
- **Quer**: ver tudo num relance, saber o que está atrasado e por quê.

### P2 — Recepção / Orçamentista (front office)
- **Contexto** [FATO]: abre a OS, registra peças/veículo/cliente, monta orçamento, fala com
  o cliente por WhatsApp.
- **Dores** [FATO]: orçamento é o maior gargalo; cliente demora a aprovar; cobra status.
- **Maturidade** [INFERÊNCIA]: média; opera sistema no balcão.

### P3 — Retificador / Mecânico de chão (usuário de produção)
- **Contexto** [FATO]: executa por estação (bloco, cabeçote, virabrequim, bomba, bico…);
  hoje o motor é órfão no sistema.
- **Dores** [INFERÊNCIA]: não quer "operar software"; quer saber o que fazer e marcar pronto.
- **Maturidade** [FATO/INFERÊNCIA]: baixa; mãos sujas de graxa. → **[DECISÃO]** interação por
  *glance* na TV + "bump" (toque grande/controle físico), nunca formulário complexo.

### P4 — Cliente final (frota, produtor, avulso)
- **Contexto** [FATO]: equipamento parado custa caro (frota/produtor com máquina única);
  acompanha por telefone/WhatsApp e liga até 2x/dia.
- **Dores** [FATO]: não sabe o andamento; principal queixa é atraso.
- **Maturidade** [INFERÊNCIA]: variada. → **[DECISÃO]** status por link, sem app nem login
  pesado.

## Jornadas de usuário

### J1 — Ciclo da OS (entrada → entrega) [FATO, do briefing]
1. Motor chega (modalidade A: só usinagem / B: empresa retira / C: cliente avisa que está tirado).
2. Recepção abre OS: peças, fotos, veículo (placa/chassi), cliente, queixa.
3. Triagem classifica a prioridade (calculada + ajuste humano).
4. Diagnóstico: desmontagem + metrologia → laudo digital.
5. Orçamento (peças + mão de obra) → enviado por link. **[GATE: aprovação]**
6. Compra de peças por demanda (estado de espera, se aplicável).
7. Execução por estação; cada uma com responsável. Avança via "bump".
8. Controle de qualidade (teste de bancada). **[GATE: CQ]**
9. Pronto → entrega/retirada (instalado pela empresa ou enviado ao cliente).
10. Finaliza: pagamento acordado → fluxo de caixa.

### J2 — Cliente acompanha e aprova [DECISÃO]
1. Cliente recebe link (WhatsApp) ao abrir a OS.
2. Vê o estágio atual e **de quem é a bola** (aprovação/peça dele × serviço da oficina).
3. Quando há orçamento, aprova ou recusa pelo próprio link.
4. Recebe atualização automática a cada mudança de estágio.

### J3 — Gestor lê o chão [DECISÃO/INFERÊNCIA]
1. Abre o painel geral (ou olha a TV).
2. Vê KPIs: OS na casa, parada crítica, travadas, **atraso (manchete)**.
3. Filtra por prioridade/estação; abre a OS órfã e descobre onde/por quê/o que falta/pra onde.

## Arquitetura de informação (Sitemap)

**App interno** (web · modo TV · mobile):
- **Login / seleção de oficina** (multi-tenant)
- **Painel de setor (modo TV)** — read-only, tela cheia, por estação [DECISÃO: é o herói]
- **Painel geral / gestor** — KPIs + todas as OS
- **OS** — lista + detalhe (as 4 perguntas, laudo, fotos, linha do tempo)
- **Triagem** — fila e classificação
- **Orçamento** — montagem + status de aprovação
- **Cadastros** — clientes, veículos/equipamentos, equipe/estações
- **Configuração / Template** — escolha do ramo (retífica pesada/agro, leve, centro automotivo)

**Portal do cliente** (público, sem login pesado):
- **Status da OS** (estágio + responsabilização) + **aprovar/recusar orçamento**

**Adaptação de navegação** [DECISÃO]: desktop = menu superior; mobile = navegação inferior na
zona do polegar; **modo TV** = quadro em tela cheia sem navegação (só leitura). Tabelas viram
cards no mobile; modais viram bottom sheets.

## Regras de negócio

- **RN-01 Gates**: não desmonta sem OS aberta; **não usina sem orçamento aprovado**; não
  entrega sem CQ aprovado. [FATO: já se queimaram iniciando sem aprovação]
- **RN-02 Triagem**: prioridade calculada pela razão crítica (prazo ÷ trabalho restante) +
  gatilhos do ramo (frota parada, máquina única do produtor, retrabalho de garantia), com
  **override humano registrado**. [FATO + DECISÃO]
- **RN-03 Travamento**: é estado separado da prioridade. `responsabilidade` = empresa | cliente.
  Travado por culpa da empresa **mantém a vez**; por culpa do cliente **pode perder a vez**.
  [FATO, do briefing]
- **RN-04 As 4 perguntas**: toda OS sempre responde onde está / por que parou / o que falta /
  pra onde vai. [FATO: definição do problema do motor órfão]
- **RN-05 Aprovação por link**: cliente aprova/recusa pelo link; sem aprovação, a OS não passa
  o gate de execução. [DECISÃO + FATO]
- **RN-06 Multi-tenant/templates**: cada oficina escolhe um template de ramo que define
  estações, gates e gatilhos de triagem. [DECISÃO]

**Fluxos de exceção**:
- Orçamento **recusado** → OS **volta a diagnóstico** para renegociação. [FATO: decidido pelo sócio]
- **CQ reprovado** → volta para execução como retrabalho interno. [FATO]
- **Peça atrasada** → estado travado; se origem = cliente, sinaliza responsabilidade do cliente. [FATO]
- **Garantia** → re-entrada vinculada à OS original, com causa registrada. [FATO]

## Critérios de sucesso por funcionalidade
- **Painel**: a equipe consegue, num relance, dizer o estágio e a pendência de qualquer OS.
- **Triagem**: prioridade consistente entre operadores; todo override fica registrado.
- **Status do cliente**: o cliente vê estágio + responsabilização; ligações de status caem.
- **Aprovação**: o cliente aprova/recusa pelo link e o gate é respeitado pelo sistema.

---

# SRS

## Requisitos funcionais
- **RF-01**: O sistema deve permitir abrir uma OS registrando modalidade de entrada (A/B/C),
  peças recebidas, fotos, veículo (placa/chassi) e cliente.
- **RF-02**: O sistema deve mover a OS por uma máquina de estados com as 3 portas obrigatórias.
- **RF-03**: O sistema deve calcular e exibir a prioridade (razão crítica) e permitir override
  humano registrado.
- **RF-04**: O sistema deve manter `travamento` como dimensão separada, com motivo e
  responsabilidade (empresa/cliente), afetando a posição na fila conforme RN-03.
- **RF-05**: O sistema deve derivar e exibir, por OS, as 4 perguntas (onde/por quê/o que
  falta/pra onde).
- **RF-06**: O sistema deve exibir um painel por setor em modo TV (read-only), com cor por
  tempo/atraso e cronômetro por etapa.
- **RF-07**: O sistema deve permitir avançar a etapa por interação simples ("bump"), adequada
  a uso com luva.
- **RF-08**: O sistema deve montar orçamento separando peças e mão de obra e enviá-lo por link.
- **RF-09**: O sistema deve permitir ao cliente aprovar/recusar o orçamento pelo link, sem
  login pesado.
- **RF-10**: O sistema deve notificar o cliente automaticamente a cada mudança de estágio.
- **RF-11**: O sistema deve registrar a linha do tempo (eventos de transição) por OS, para
  cálculo de tempo parado/atraso e como prova de garantia.
- **RF-12**: O sistema deve calcular KPIs de gestão: OS na casa, parada crítica, travadas e
  atraso (com separação de culpa).
- **RF-13**: O sistema deve suportar múltiplas oficinas (multi-tenant) com templates de ramo
  configuráveis (retífica pesada/agro, leve, centro automotivo).

## Requisitos não-funcionais

### Segurança (devdead-sec — gravado aqui para viajar com a doc)
- **RNF-SEC-01 Autenticação/sessão**: login com sessão segura e expiração; proteção de
  credenciais (hash forte). Método (JWT × sessão server-side) decidido na Fase 3 (ADR).
- **RNF-SEC-02 Autorização (RBAC)**: papéis (dono/gestor, recepção/orçamentista, produção,
  e acesso público restrito do cliente); cada papel só acessa o que lhe cabe.
- **RNF-SEC-03 Isolamento multi-tenant**: dados de uma oficina nunca acessíveis por outra;
  isolamento aplicado em toda consulta. [decisão de implementação → ADR na Fase 3]
- **RNF-SEC-04 2FA**: **exigido para perfis administrativos** (dono/gestor); opcional para os
  demais; fluxo de recuperação de conta seguro.
- **RNF-SEC-05 Threshold de tentativas**: bloqueio após N tentativas inválidas — **valor
  configurável** (não chumbado).
- **RNF-SEC-06 Criptografia**: HTTPS em trânsito; dados sensíveis em repouso protegidos.
- **RNF-SEC-07 Link público do cliente**: token não adivinhável, escopo mínimo (só aquela OS),
  com expiração; rate limiting.
- **RNF-SEC-08 LGPD**: placa, chassi e dados do cliente são dados pessoais — definir base legal,
  retenção e direito de acesso/exclusão do titular; mascaramento em logs.

### Performance
- **RNF-PERF-01**: atualização do painel em tempo (quase) real — alvo de propagação de
  mudança de estado < ~2s.
- **RNF-PERF-02**: modo TV estável para operação contínua (always-on).

### Escalabilidade
- **RNF-ESC-01**: arquitetura multi-tenant que cresça de dezenas para centenas de oficinas
  sem reescrita.

### Disponibilidade / Observabilidade
- **RNF-DISP-01**: meta de uptime a definir; o painel deve **tolerar queda de rede** no chão
  (reconectar/manter último estado).
- **RNF-OBS-01**: logs e métricas de operação (com dados sensíveis mascarados).

---

## Resumo dos entregáveis da Fase 2
- PRD: 4 personas, 3 jornadas, sitemap (app interno + portal do cliente), 6 regras de negócio
  com fluxos de exceção, e critérios de sucesso por funcionalidade.
- SRS: 13 requisitos funcionais e os não-funcionais, com a camada de segurança (8 RNF-SEC),
  performance, escalabilidade e disponibilidade.

**Decidido pelo sócio**: orçamento recusado **volta a diagnóstico**; **2FA apenas para perfis
administrativos**; **uptime a definir** na arquitetura. **Próximo gate**: Fase 3 (Arquitetura:
stack, ERD, API, EAP, fixo vs configurável, migração e testes).
