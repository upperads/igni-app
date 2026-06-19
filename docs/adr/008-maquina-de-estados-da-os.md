# ADR-008: Máquina de estados da OS, gates e as 4 perguntas

## Contexto
O núcleo do Igni (M2) é a Ordem de Serviço caminhando por etapas com **3 gates inegociáveis**
(RN-01) e respondendo sempre às **4 perguntas** (RN-04). Precisa ser lógica de domínio pura,
testável em isolamento e desacoplada da web (CLAUDE.md / ADR-003), antes de qualquer schema/UI.

## Decisão
**Estados** (derivados da jornada J1 do PRD):
`aberta` → `diagnostico` → `orcamento` → `aguardando_aprovacao` → (`aguardando_peca`) →
`execucao` → `controle_qualidade` → `pronta` → `entregue`.

**Transições permitidas** (incluindo os fluxos de exceção do PRD):
- aberta → diagnostico
- diagnostico → orcamento
- orcamento → aguardando_aprovacao (envia o link)
- aguardando_aprovacao → aguardando_peca | execucao (aprovado) | diagnostico (**recusado**, volta a diagnóstico)
- aguardando_peca → execucao (peça chegou)
- execucao → controle_qualidade
- controle_qualidade → pronta (aprovado) | execucao (**reprovado**, retrabalho)
- pronta → entregue
- entregue → (terminal)

**Gates** (condições extras em transições específicas, RN-01):
1. **Não desmonta sem OS aberta**: `diagnostico` só vem de `aberta` (estrutural).
2. **Não usina sem orçamento aprovado**: entrar em `execucao` exige `orcamentoAprovado`.
3. **Não entrega sem CQ aprovado**: `controle_qualidade → pronta` exige `cqAprovado`.

Toda transição válida grava um **EVENTO** (de/para/quem/quando/motivo) — a linha do tempo e a
prova de garantia (RF-11). Transição barrada por gate explica **o que falta** (prevenção de erro).

**As 4 perguntas** são derivadas puramente do estado (onde está / por que parou / o que falta /
pra onde vai), exibidas em toda OS e travamento.

**Travamento e prioridade** são dimensões SEPARADAS do estado (RN-03/RN-02), não estados — entram
no M3, não aqui.

## Alternativas consideradas
- **Estado livre (string sem validação)**: frágil, permitiria transição inválida. Descartado — a
  máquina de estados é justamente o que impede isso.
- **Gates como estados** (ex.: um estado "bloqueado"): polui a máquina; gate é condição de
  transição, não lugar. Descartado.
- **Montar orçamento dentro de `diagnostico`**: fundiria duas etapas com donos diferentes
  (metrologia × orçamentista). Mantido `orcamento` separado.

## Consequência
A máquina de estados nasce como funções puras (`validarTransicao`, `quatroPerguntas`) com testes
de unidade cobrindo todas as transições e os 3 gates (Definition of Done da US-05). O enum
`estado_os` do banco espelhará `ESTADOS_OS` (teste de drift). Os casos de uso (abrir OS, executar
transição gravando EVENTO) e o schema (cliente/equipamento/entrada/os/evento) vêm nas próximas
fatias, consumindo esta lógica.
