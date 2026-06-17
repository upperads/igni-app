# Arquitetura de UX — PRONTO (codinome)

> Fase 3, **Parte B**. Design system, grid/breakpoints, direção visual anti-genérico e spec
> por tela (6 estados) das telas-herói. Complementa a Parte A (`03_architecture.md`).
> Etiquetas: **[FATO]** · **[INFERÊNCIA]** · **[DECISÃO]** · **[AMBIGUIDADE]**.

---

## 1. Direção de design — anti-genérico (processo de duas passadas)

### Âncora no assunto
O produto vive em dois contextos opostos: a **TV na parede de uma oficina engraxada**, vista
de longe e no barulho; e o **celular do cliente**, que quer ser tranquilizado. Materiais do
mundo: aço, graxa, óleo, micrômetro, chave de torque, listras de risco (proteção de máquina),
o farol e o torque. [FATO/INFERÊNCIA]

### Passada 1 — sistema de tokens

**Cor** (canvas grafite de cast quente — não preto frio — + paleta de sinal + âmbar de segurança):
- `grafite-900` #14161A — canvas (board)
- `grafite-800` #1E2127 — superfícies/cards
- `grafite-700` #2A2E37 — bordas/divisores
- `aco-100` #E8EBF1 / `aco-200` #C7CCD6 — texto primário/secundário
- `ambar-500` #F2A93D — **marca + sinalização estrutural** (listra de risco, foco/ativo). Nunca é status.
- Paleta de **sinal/triagem** (só status, fosca — não neon): `vermelho` #E5392F · `laranja` #FB7A28 · `amarelo` #E8C53A · `verde` #46B46E · `azul` #4A90D9.
- Portal do cliente (tema claro): `osso-50` #F7F6F3 (claro quente, **não** o creme-clichê) + os mesmos grafite/âmbar.

**Tipo** (3 papéis, ancorados em "equipamento" e "instrumento"):
- **Display**: condensada industrial (ex.: Saira Condensed) — feel de placa/etiqueta de equipamento; títulos, números de KPI, nomes de estação, com parcimônia. [DECISÃO]
- **Corpo**: grotesca robusta (ex.: Archivo) — UI.
- **Dados**: monoespaçada (ex.: Spline Sans Mono) — código de OS, cronômetros, medidas (leitura de instrumento).

**Layout** (uma frase + wireframe):
"Um quadro de triagem de pronto-atendimento: colunas são etapas, cards são serviços, a **cor é o dado**, e um trilho de risco no topo sinaliza a parede."
```
┌─ trilho de risco (acende em âmbar se há crítico/atraso) ──────────────┐
│ SETOR: CABEÇOTE        14:32     fila 3 · exec 2 · travada 1 · atraso 1│
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│ ▌OS-2041     │ ▌OS-2038 ⏸    │ ▌OS-2050     │  (rola / auto-scroll)   │
│ ▌Scania DC13 │ ▌JD PowerTech│ ▌MF Perkins  │                         │
│ ▌Marcão  03d │ ▌Cleiton 2d ⚠│ ▌— 0d        │                         │
└──────────────┴──────────────┴──────────────┴────────────────────────┘
   ▌ = espinha de status na cor da triagem   ⏸ = travado   ⚠ = perto do prazo
```

**Assinatura** (o único elemento memorável): a **espinha de status + trilho de risco-alarme**.
Cada card tem uma faixa lateral grossa na cor da triagem e um cronômetro que vira branco→âmbar→
vermelho conforme o prazo; o trilho 45° no topo do board acende em âmbar quando há qualquer
crítico/atraso naquela tela — um **alarme periférico visível do outro lado da oficina**. [DECISÃO]

### Passada 2 — crítica contra o genérico
O board escuro se aproxima do **clichê de IA nº2** (quase-preto + acento ácido). Escapo assim,
e digo o que muda e por quê:
- Grafite de **cast quente**, não preto frio neutro.
- A **paleta de sinal de 5 cores É o dado** — não há "um acento neon"; o destaque é funcional.
- O âmbar é **material de domínio** (listra de risco/segurança, sol de galpão), usado de forma
  **estrutural**, não como brilho decorativo.
- Par tipográfico **placa+instrumento** lê "equipamento", não "SaaS escuro genérico".
- O **trilho de risco-alarme** é assinatura ancorada no chão de fábrica.
Resultado: "quadro de triagem de retífica", não template. O **portal do cliente** diverge de
propósito (tema claro, tranquilizador) porque o público é outro — mesma marca, registro
diferente. [DECISÃO]

> **Acessibilidade da cor**: a triagem nunca depende só da cor — sempre **cor + rótulo/letra +
> posição** (daltônicos e o "estrutura é informação"). [DECISÃO]

---

## 2. Design system e grid

**Breakpoints**: mobile < 600px · tablet < 1024px · desktop ≥ 1024px · **modo TV** = tela cheia
≥ 1080p com escala tipográfica ampliada e sem navegação. [DECISÃO]

**Grid**: 4 colunas (mobile) · 8 (tablet) · 12 (desktop); margens/gutters por breakpoint.
Tabelas → **cards** no mobile; modais → **bottom sheets**; menu superior (desktop) → inferior
na zona do polegar (mobile).

**Componentização (smart vs dumb)**: o "cérebro" do card de OS (estado, prioridade, cronômetro)
vive separado da apresentação, para o mesmo dado renderizar como **card de TV**, **card mobile**
e **linha de timeline**. Detecção de viewport/input ajusta alvo de toque e navegação. [DECISÃO]

**Heurísticas de Nielsen (aplicadas)**:
- **Prevenção de erro**: os gates bloqueiam transição inválida com o motivo explícito.
- **Consistência**: o mesmo card e as mesmas cores em todas as telas.
- **Liberdade/desfazer**: é possível **recolher um "bump"** (recall, como no KDS) sem trocar de tela.
- **Visibilidade do estado**: o produto inteiro é visibilidade — estado sempre à vista.

**WCAG 2.2 AA**: contraste ≥ 4.5:1 (texto)/3:1 (texto grande e ícones de status) — validar a
paleta de sinal sobre grafite; foco visível; navegação por teclado; alvo de toque ≥ 44–48px
(crítico no "bump" com luva → alvo **grande**, bem acima do mínimo). [DECISÃO]

**UX de segurança**: tela de 2FA (perfis administrativos), força de senha em tempo real,
mensagem de bloqueio por threshold, e **toggle de mascaramento do chassi/placa** (LGPD).

---

## 3. Spec por tela (telas-herói, 6 estados)

### Tela: Painel de setor (modo TV) — herói
**Objetivo** [FATO/DECISÃO]: a equipe vê de relance e à distância todas as OS da estação,
prioridade por cor e tempo, o que está travado, e avança a etapa por "bump".

**Elementos**: cabeçalho (nome do setor, relógio, contadores na fila/exec/travadas/atraso);
cards de OS (espinha de status, código, equipamento, responsável, cronômetro colorido, selo
travado/⚠); trilho de risco no topo; **zona de bump grande** por card.

**6 estados**:
1. **Sucesso** — bump avança a OS; card anima a saída e some da coluna; toast curto "OS-2041 → CQ".
2. **Erro** — queda do realtime → banner "Reconectando… exibindo último estado" (não trava). Bump barrado por gate → o card **sacode** e mostra o motivo ("Falta aprovação do cliente").
3. **Vazio** — estação sem OS → marca discreta + "Nenhum serviço neste setor agora."
4. **Carregando** — skeleton dos cards.
5. **Permissão negada** — modo TV é read-only; a TV pública não mostra ações; usuário sem permissão que tenta bump recebe aviso.
6. **Overflow** — muitas OS → coluna rola / auto-scroll no modo TV; equipamento longo trunca com reticências.

**Responsivo**: TV = tela cheia, colunas, fonte grande, zero navegação. Desktop = mesmo board com nav lateral. Mobile = **uma coluna** (a estação), cards empilhados, **bump na zona do polegar**.
**Microinterações**: cronômetro muda de cor; bump com feedback tátil/visual; trilho acende em âmbar quando há crítico/atraso.

---

### Tela: Detalhe da OS
**Objetivo** [FATO]: responder as 4 perguntas (onde/por quê/o que falta/pra onde), ver
laudo/fotos/linha do tempo e mover a OS respeitando os gates.

**Elementos**: cabeçalho (código, equipamento, motor, pill de prioridade + motivo); **bloco das
4 perguntas** em destaque; estado atual → próximo (com o gate); selo de travamento (motivo +
responsabilidade); laudo (medidas/fotos); linha do tempo (eventos); ações (avançar, travar,
override de prioridade, gerar orçamento).

**6 estados**:
1. **Sucesso** — avançar estado → confirma e atualiza a timeline.
2. **Erro** — avançar sem gate cumprido → bloqueia e explica o que falta.
3. **Vazio** — OS recém-aberta sem laudo/orçamento → seções com "ainda não" + CTA.
4. **Carregando** — skeleton.
5. **Permissão negada** — produção não edita orçamento; campos viram read-only.
6. **Overflow** — timeline longa → scroll/colapso; muitas fotos → galeria.

**Responsivo**: desktop = duas colunas (4 perguntas/ações | laudo/timeline); mobile = uma coluna, ações em **bottom sheet**.
**Microinterações**: a barra de progresso anima na mudança de estado; **toggle de mascaramento** no chassi (LGPD).

---

### Tela: Portal do cliente
**Objetivo** [DECISÃO]: o cliente vê o estágio do serviço e **de quem é a bola**, e aprova/recusa
o orçamento. Tema claro, tranquilizador.

**Elementos**: cabeçalho leve (marca + "Seu serviço"); **stepper do estágio**; **destaque de
responsabilização** ("Aguardando sua aprovação" / "Aguardando a peça que você vai fornecer" /
"Em serviço na oficina"); quando há orçamento: resumo + botões **Aprovar**/**Recusar**; previsão.

**6 estados**:
1. **Sucesso** — aprovar → "Aprovado! Seguimos para a próxima etapa." e o estágio avança.
2. **Erro** — link expirado/inválido → "Este link expirou, peça um novo à oficina." Falha de rede → repetir.
3. **Vazio** — serviço aberto sem orçamento → "Recebemos seu serviço. Avisamos quando o orçamento estiver pronto."
4. **Carregando** — skeleton leve.
5. **Permissão negada** — token não corresponde à OS → "Não encontramos este serviço."
6. **Overflow** — orçamento com muitos itens → lista rolável; descrições truncam.

**Responsivo**: **mobile-first** (abre no WhatsApp); desktop centraliza.
**Microinterações**: confirmação de aprovação com micro-animação discreta; o destaque "de quem é
a bola" fica **âmbar** quando a pendência é do cliente. Copy do lado do usuário, voz ativa.

---

### Demais telas essenciais (herdam os padrões acima)
- **Login / seleção de oficina** — multi-tenant; 2FA para admin; estados de erro de credencial e bloqueio por threshold.
- **Abertura de OS** — modalidade A/B/C, peças, fotos, veículo, cliente; validação inline (prevenção de erro).
- **Triagem (fila)** — lista ordenada por `prioridade_score`; override registrado; travados sinalizados.
- **Painel geral / gestor** — KPIs (na casa, parada crítica, travadas, **atraso** como manchete); filtros.

Cada estado destas telas vira (ou reforça) um critério de aceite no backlog da Fase 4.

---

## Resumo da Parte B
Direção visual anti-genérico justificada (sistema de tokens + crítica de duas passadas), design
system com grid/breakpoints, heurísticas de Nielsen aplicadas, WCAG 2.2 AA, UX de segurança, e
spec das 3 telas-herói (TV, detalhe da OS, portal do cliente) com os 6 estados — mais as demais
telas referenciadas.

**Com isto, a Fase 3 (Partes A + B) está completa** e pronta para aprovação. Próximo: Fase 4
(Product Backlog com critérios de aceite/teste + `CLAUDE.md` e handoff pro agente de código).
