# Mapa do Produto — Igni (visão do todo + o que falta pra implantar)

> Inventário HONESTO e verificado no código (não um resumo bonito). Objetivo: recuperar a visão do
> todo depois de 14 fatias, e separar **o que está pronto** do **que falta pra uma retífica REAL
> botar pra rodar**. A pergunta do dono: *"como vai ser a implementação do app como um todo?"* — a
> resposta começa por ver o que existe vs. o buraco de implantação.

## 1. As 15 telas que existem hoje (e quem usa cada uma)

| Rota | O que é | Quem usa | Estado |
|---|---|---|---|
| `/criar-conta` | Onboarding: nome da oficina + ramo + admin | Dono (1ª vez) | ✅ funciona, mas **leva a um painel VAZIO** |
| `/login` · `/login/2fa` | Entrar + 2FA (admin) | Todos | ✅ |
| `/recuperar` · `/atualizar-senha` | Recuperação de senha | Todos | ✅ (SMTP cloud pendente) |
| `/` (Painel) | Board ao vivo: KPIs + responsabilização (vivo+histórico) + cards por etapa | Dono/gestão | ✅ |
| `/chao` | Quiosque do chão: cards enormes, bump 1 toque | Produção | ✅ |
| `/triagem` | Fila ordenada por impacto (razão crítica + regra da vez) | Recepção/gestão | ✅ |
| `/os` | Lista de OS | Todos | ✅ |
| `/os/nova` | Abrir OS (cliente+equipamento+entrada nascem aqui) | Recepção | ✅ |
| `/os/[id]` | Detalhe: medidor + responsabilização + orçamento + triagem + timeline + WhatsApp | Recepção/gestão | ✅ |
| `/relatorio` | Relatório de Bola + ROI (adoção do chão, atraso fora da alçada) | Gestão | ✅ |
| `/painel/tv` | Modo TV (parede, read-only, responsabilização grande) | Chão (parede) | ✅ |
| `/portal/[token]` | Portal do cliente (status honesto, aprovar/recusar, sem login) | Cliente final | ✅ |
| `/primeiros-passos` | Guia didático (texto) | Dono | ✅ texto, ⚠️ **promete telas que não existem** |

## 2. O modelo de dados (o "esqueleto" — tudo com tenant_id + RLS)
`tenant` (a oficina) · `usuario` (papel: dono/gestor/recepcao/producao) · `estacao` (semeada por
template) · `cliente` · `equipamento` · `entrada` · `os` (número sequencial, estado, prioridade,
travamento, cq) · `evento` (linha do tempo + **origem** = adoção do chão) · `orcamento` +
`orcamento_item` · `ajuste_prioridade` · `tenant_contador_os`. **12 ADRs** registrados.

## 3. Os fluxos que JÁ FUNCIONAM ponta a ponta
- **Ciclo da OS:** abrir → triagem ao vivo → orçamento → cliente aprova/recusa (portal/interno) →
  execução (gate real: não usina sem aprovado) → CQ → pronta → entregue.
- **Adoção do chão:** produção avança etapa com 1 toque no `/chao`; cada toque vira número no relatório.
- **Responsabilização:** "de quem é a bola" interno + status honesto pro cliente + WhatsApp-out + relatório.
- **Tempo real:** mudança propaga < 2s (painel/TV/portal).

---

## 4. O BURACO DE IMPLANTAÇÃO — P0 FECHADO (2026-06-27)

Diagnóstico original: o app tinha um **core brilhante** mas **não saía do zero ao funcionando
sozinha.** O **P0 da Fase de Implantação foi construído** (equipe + estações + onboarding guiado);
restam P1/P2.

| # | Gap | Estado | Onde |
|---|---|---|---|
| **I1** | **Convidar a equipe** (recepção + produtivos) | ✅ **FEITO** — convite com senha provisória (sem SMTP), papel, desativar/reativar; desativado perde o acesso de verdade (sessão não resolve perfil) | `/config/equipe` |
| **I2** | **Ver/editar Estações** | ✅ **FEITO** — renomear, reordenar (↑↓), adicionar, remover (bloqueia se há OS na estação) | `/config/estacoes` |
| **I3** | **Painel vazio no 1º acesso** | ✅ **FEITO** — vira "Comece por aqui" (3 passos com checkmarks) enquanto a oficina é nova; some quando começa a rodar | `/` (só dono/gestor) |
| **I4** | **Primeiros-passos era só TEXTO** | ✅ **resolvido pelo I3** — o guia agora tem os botões reais (equipe, estações, 1ª OS). O `/primeiros-passos` em prosa segue como leitura calma | `ComecePorAqui` |
| **I5** | **Dados de exemplo (seed de demo)** | ✅ **FEITO** — "Preencher com exemplo" cria um cenário de venda completo (8 OS por todos os estados, orçamentos, histórico que enche o relatório); marcado `is_demo` e reversível ("Limpar demonstração"), sem sujar o banco real | `ComecePorAqui` + `/config/demonstracao` |
| **I6** | **Cadastro de Clientes como entidade** | ✅ **FEITO** — abrir OS REUSA o cliente pelo WhatsApp normalizado (não duplica); telas `/clientes` (listar/buscar, nº de OS) e `/clientes/[id]` (histórico) | `/clientes` + `domain/os/cliente.ts` |
| **I7** | **Atribuir OS a uma estação física** | ✅ **FEITO** — seletor de estação no detalhe da OS (`os.estacao_id`); `/chao` ganhou toggle "Por etapa / Por estação" | `/os/[id]` + `/chao?por=estacao` |
| **I8** | **Convite por LINK de e-mail** (em vez de senha provisória) | ⏳ P1 — depende de **SMTP cloud** (pendência técnica conhecida). A porta de auth já isola isto; ver §9 | gancho pronto |

## 5. O que isto significa pra "levar a uma retífica" (a resposta direta)
**Com o P0 fechado, dá pra implantar um PILOTO de forma autônoma.** O dono cria a conta, é recebido
por um guia de 3 passos, convida a equipe (cada um com login próprio, senha provisória entregue na
hora — sem depender de e-mail), confere as estações do seu ramo e abre a 1ª OS. O pessoal do chão
entra e toca. **A cadeia não quebra mais no passo 2.**

O que falta agora é **polimento de venda/escala** (P1/P2), não bloqueador de piloto.

## 6. A jornada de implantação — agora completa (P0)
Como uma retífica sai do zero ao funcionando:

```
1. Dono cria a conta + escolhe o ramo            ✅ /criar-conta
2. É recebido pelo guia "Comece por aqui"        ✅ / (I3)
3. Convida a equipe (recepção + produtivos)      ✅ /config/equipe (I1)
4. Confere/ajusta as estações do ramo            ✅ /config/estacoes (I2)
5. Recepção abre a 1ª OS real                     ✅ /os/nova
6. Produtivo loga no tablet e move pelo /chao    ✅ /chao (agora com login próprio)
7. Cliente recebe o status (WhatsApp/portal)     ✅
8. Dono vê o relatório no fim da semana          ✅ /relatorio
```
**Nenhum elo quebrado.** O piloto roda fim a fim.

## 7. Plano da Fase de Implantação — estado
- **P0 (FEITO, 2026-06-27):** I1 (equipe) + I2 (estações) + I3/I4 (onboarding guiado). Piloto destravado.
- **P1 (próximo):** I8 (convite por link de e-mail — depende de SMTP cloud; ver §9).
- **P2:** I5 (seed de demo pra venda) + I6 (cadastro de clientes) + I7 (estação física na OS).

## 8. (mantido) O que continua sendo do CAMPO (não-código)
Preço/contrato, suporte, quem instala na oficina, e a validação das 3 hipóteses ([docs/11](11_validacao_mercado.md)).
O código já chega em "a oficina implanta sozinha"; o resto é operação e venda.

## 9. Gancho da fatia P1 — convite por LINK de e-mail (I8)
Hoje o convite usa **senha provisória** (`AuthIdentityPort.criarComSenhaProvisoria`) — escolha
deliberada para **não depender de SMTP** e destravar o piloto já. Quando o **SMTP cloud** estiver
configurado (pendência técnica conhecida, junto de `site_url`), dá pra oferecer o convite por link
"defina sua senha" SEM reescrever a tela:

- A porta `AuthIdentityPort` já isola o provedor. Basta um novo método (ex.: `convidarPorEmail`)
  que use `admin.auth.admin.inviteUserByEmail` / `generateLink('invite')` do Supabase.
- A action `acaoConvidarMembro` ganharia um modo "link" (sem devolver senha; o e-mail faz o trabalho).
- A linha `usuario` é criada igual; `authUserId` segue nullable até o convidado aceitar — o schema já
  previa isso ("Nulo enquanto o usuário não tem identidade (ex.: convidado)").
- **Pré-requisito:** SMTP cloud + `site_url` corretos, senão o e-mail não sai e o piloto trava — por
  isso a senha provisória é o caminho padrão até lá.

## 8. O que continua sendo do CAMPO (não-código)
Preço/contrato, suporte, quem instala na oficina, e a validação das 3 hipóteses ([docs/11](11_validacao_mercado.md)).
O código pode chegar até "a oficina implanta sozinha"; o resto é operação e venda.
