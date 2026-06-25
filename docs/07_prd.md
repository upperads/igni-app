# PRD — Igni (produto inteiro, M5→M8)

> Fase 4a da cadeia. PRD sem ambiguidade, ancorado em RICE ([06](06_priorizacao_rice.md)), auditoria
> ([UX V1](UX_AUDIT_DOSSIE_V1.md)) e branding ([05](05_branding.md)). Sem Playwright — evidência de código.
> Régua de marca **É / NÃO-É** ([05 §7](05_branding.md)) governa todo escopo: feature que só cabe na
> coluna "NÃO É" não entra.
>
> **⚠️ Revisado pós-pesquisa de mercado ([08](08_pesquisa_mercado.md)).** Achados que mudam ênfases (não o escopo):
> (1) painel ao vivo, prioridade, aprovação por link e portal são **commodity** — viram "higiene competitiva",
> não manchete de venda; (2) o **único espaço em branco verificado** é a **responsabilização do atraso**
> (`culpaDoAtraso` — ninguém no mercado faz) → vira o **pilar** do produto; (3) o portal mede-se por **redução
> de ligações**, não só "abertura"; (4) responsabilização = **transparência, nunca isenção de culpa (CDC)**;
> (5) **simplicidade vira requisito mensurável**, não slogan. A profundidade da responsabilização (histórico/
> relatório) fica para **decidir no SDD** — anotada como candidata em F-Resp.

## 0. Contexto e o que já está pronto (não rebriefar)

**Em produção (M1–M4):** auth/2FA (ADR-006), OS + máquina de estados (ADR-008), triagem/razão crítica + travamento (ADR-009), painel + modo TV + bump/recall + realtime (ADR-010). **M5 orçamento: domínio e casos de uso prontos e testados** (`montarOrcamento`/`enviarOrcamento`/`aprovarOrcamento`/`recusarOrcamento`/`aprovarCq`/`resolverContextoGate` em [orcamento.ts](../src/application/orcamento.ts); gate real provado em [orcamento.test.ts](../src/application/__tests__/orcamento.test.ts)) — **falta a UI e a UI ainda não está commitada.**

**Métrica-mãe (governa tudo):** ≥15–25 oficinas pagantes, churn <3% em 12 meses ([01](01_conception.md)). Toda métrica de feature abaixo é proxy disso.

**Corte do PRD:**
- **MVP vendável** = F1 (M5 UI orçamento) + F2 (M6 portal) + F3 (polimento) + F4 (número de OS).
- **Escala pós-validação** = F5 (M7 WhatsApp) + F6 (M8 templates de ramo).

---

## F1 — Orçamento: montar e enviar (M5 UI) · MVP

**Problema (evidência):** o gargalo é a espera, não o trabalho; o que atrasa é aprovação de orçamento e peça ([01](01_conception.md)). Hoje o orçamento existe no domínio mas **não tem tela** — a OS trava em "diagnóstico" para sempre e o gate "não usina sem orçamento aprovado" é teórico.

**Usuário:** orçamentista / recepção (papéis `gestor`/`recepcao`/`dono`; `producao` **não** edita orçamento — RBAC já existe, `pode()` em [rbac.ts](../src/domain/auth/rbac.ts)).

**Métrica de sucesso:** em piloto, ≥80% das OS que passam de "orçamento" têm orçamento montado no Igni (não no caderno); tempo médio diagnóstico→enviado < 1 dia útil.

### User stories (Given/When/Then)

**US-F1.1 — Montar itens**
- Given uma OS aberta e um usuário com permissão de orçamento, When ele abre a seção Orçamento no detalhe da OS, Then vê o orçamento em rascunho (criado on-demand) com lista de itens vazia e o total em R$ 0,00.
- Given o rascunho, When adiciona um item (tipo ∈ {peça, mão de obra, terceiro}, descrição obrigatória, valor em R$, markup % inteiro ≥0), Then o item aparece na lista e os subtotais por tipo + total recalculam na hora.
- Given um item de terceiro com valor R$ 100 e markup 20, Then o total do item exibe R$ 120,00 (regra `totalItem` já testada).
- Given itens no rascunho, When remove um item, Then ele some e os totais recalculam.
- **Regra:** itens só editáveis em `rascunho` (`podeEditarItens`). Dinheiro em centavos inteiros (sem float).

**US-F1.2 — Enviar ao cliente**
- Given um orçamento em rascunho com ≥1 item, When clica "Enviar ao cliente", Then o status vira `enviado`, gera-se um token (só o hash é guardado), define-se expiração (7 dias) e exibe-se o link do portal para copiar/compartilhar.
- Given um rascunho sem itens, When tenta enviar, Then a ação é barrada com "Para enviar, o orçamento precisa ter itens." (`podeEnviar`).
- **Regra:** o link aponta para o portal do cliente (F2). Token nunca exibido depois do envio (só o hash persiste).

**US-F1.3 — Gates reais (a regra de ouro deixa de ser teórica)**
- Given uma OS cujo orçamento **não** está `aprovado`, When alguém tenta mover para `execução` (bump ou detalhe), Then é barrado com "Não dá pra usinar: o orçamento ainda não foi aprovado." (gate via `resolverContextoGate`).
- Given uma OS em `controle_qualidade` sem CQ aprovado, When tenta mover para `pronta`, Then é barrado com o motivo do CQ.
- Given uma OS em `controle_qualidade`, When o operador clica "Aprovar CQ", Then `cqAprovado` vira true e o gate CQ→pronta passa; reentrar no CQ (retrabalho) zera a aprovação (já testado).
- **Esta US é majoritariamente wiring de UI + composição** — o domínio já garante o comportamento.

### 6 estados da tela (seção Orçamento no detalhe da OS)
1. **Sucesso** — itens listados, totais por tipo + total, ações conforme status (editar/enviar/aprovar/recusar/reabrir).
2. **Vazio** — rascunho sem itens: "Nenhum item ainda. Some peças, mão de obra e serviços de terceiro."
3. **Carregando** — skeleton da lista (evita salto de layout).
4. **Erro** — falha ao salvar/enviar: inline, com retry, sem perder o que foi digitado.
5. **Permissão negada** — papel `producao`: seção em modo leitura, sem botões de edição (mensagem clara).
6. **Overflow** — muitos itens rolam; descrição longa trunca com reticências (achado da auditoria).

**Fora de escopo F1:** laudo/metrologia estruturado, anexos/fotos no item, múltiplas versões de orçamento por OS (uma por OS — `orcamento_os_unico`), impressão/PDF. Fiscal/financeiro: **NÃO É** (integração futura).

---

## F2 — Portal do cliente (M6) · MVP · o PILAR do diferencial

**Problema (evidência):** a queixa nº1 do cliente final é o atraso, hoje respondido por ligação ([01](01_conception.md)). **O portal em si NÃO é diferencial** — Certtus, ServiceTitan, Jobber e Produttivo já têm portal ([08 §1](08_pesquisa_mercado.md)). **O diferencial é o que o portal MOSTRA:** de quem é a bola. A pesquisa verificou que **nenhum concorrente responsabiliza o atraso** — nem o OnlineOS, o mais focado em prazo ([08 §9.2](08_pesquisa_mercado.md)). Hoje só existe o token `--osso-50`; nenhuma tela clara no código.

**Usuário:** cliente final (sem conta, sem login pesado). Acessa por link com token.

**Métrica de sucesso (revisada):** **métrica-chave = redução mensurável de ligações de status** no piloto (a dor real — medir com a oficina-cobaia, baseline vs pós-Igni). Secundárias: ≥60% dos orçamentos enviados abertos pelo cliente; tempo enviado→decisão < 24h. *(O "% de abertura" sozinho não prova valor — Certtus já notifica; o que prova é o telefone parar de tocar.)*

**Regra de negócio crítica (CDC) — não-negociável:** a responsabilização comunica **estado e dependência**, nunca **isenção de culpa**. Textos permitidos: "Aguardando a peça que você vai enviar", "A bola está com a oficina agora". Textos **proibidos**: qualquer um que afirme/insinue que a oficina não é responsável pelo atraso. Juridicamente a oficina responde mesmo com peça do cliente atrasada ([08 §4.1](08_pesquisa_mercado.md)) — revisar no `/auditoria-seguranca`/LGPD.

### User stories

**US-F2.1 — Ver o estágio e de quem é a bola**
- Given um link válido (token não expirado), When o cliente abre, Then vê, em **tema claro**: o equipamento, um **stepper** do estágio atual da OS, e — se travado — **de quem é a bola** em destaque âmbar quando a pendência é dele.
- Given um token expirado/inválido, When abre, Then vê uma página de erro clara ("Este link expirou. Peça um novo à oficina."), **sem** vazar dados da OS.
- **Regra (segurança):** o token abre **só a sua própria OS** (escopo mínimo); nunca lista outras; nunca expõe dado de outro tenant. (Isolamento será detalhado no SDD/ADR de segurança.)

**US-F2.2 — Aprovar / recusar o orçamento sem login**
- Given um orçamento `enviado` e um token válido, When o cliente vê os itens (peças/mão de obra/terceiro + total) e clica "Aprovar", Then o status vira `aprovado`, o gate de execução libera, e ele vê confirmação clara.
- Given o mesmo, When clica "Recusar", Then o status vira `recusado` e a OS **volta a diagnóstico** para renegociação (regra já testada).
- Given erro de rede na decisão, When tenta de novo, Then a ação é idempotente/repetível sem efeito duplicado.
- **Regra:** decisão só vale em `enviado` (`podeDecidir`). Aprovar **não** avança a OS sozinho (pode ir a peça ou execução — decisão do chão).

### 6 estados (portal)
1. **Sucesso** — estágio + responsabilização; se há orçamento enviado, os itens + botões aprovar/recusar.
2. **Vazio/sem-orçamento** — só o stepper (a OS ainda não tem orçamento para decidir).
3. **Carregando** — skeleton claro.
4. **Erro** — token expirado/inválido tratado, sem vazar OS.
5. **Permissão** — o token é read-mostly: só permite aprovar/recusar **o próprio** orçamento.
6. **Overflow** — muitos itens no orçamento rolam; descrições truncam.

**Fora de escopo F2:** histórico completo da OS para o cliente, chat, anexos, pagamento online. O portal é **status + decisão**, não um cliente-ERP (NÃO É).

---

## F3 — Polimento de confiança (MVP) · honestidade = legibilidade

**Problema (auditoria V1):** estados loading/erro ausentes (tela branca em rede ruim), board que muda sozinho sem `aria-live`, contraste de `aco-400` a validar, navegação com link quebrado (`/cadastros`). Mina a confiança numa demo/piloto.

**Usuário:** todo operador (e o avaliador na demo).

**Métrica:** zero tela-branca observável em rede degradada; AA de contraste em texto secundário; zero link morto na navegação.

### User stories (todas com aceite verificável)
- **US-F3.1** Given rede lenta, When uma tela de dados carrega, Then exibe skeleton (não branco) — `loading.tsx` em painel/detalhe/triagem/TV.
- **US-F3.2** Given falha de leitura, When a tela quebra, Then exibe `error.tsx` temático com retry (não stack trace).
- **US-F3.3** Given o board ao vivo, When uma OS muda por realtime, Then uma região `aria-live="polite"` anuncia a mudança (acessibilidade no chão).
- **US-F3.4** Given texto secundário, Then usa um tom (`aco-300`, a criar) que passa AA 4.5:1 sobre grafite.
- **US-F3.5** Given a navegação, Then só lista rotas que existem; "Modo TV" acessível pelo shell; nada aponta para `/cadastros` inexistente (ou cria-se a rota).
- **US-F3.6** Given OS inexistente/token inválido, Then `not-found.tsx` temático (não o genérico).

**Fora de escopo F3:** auto-scroll do modo TV (P0-3, fica para piloto-ready — score baixo), redesign; é polimento cirúrgico, não reforma.

---

## F4 — Número sequencial de OS por tenant (MVP-adjacente)

**Problema:** o card mostra hash do id (`refCurta`) — o chão não decora "a1b2c3d4". A marca fala a língua do chão ([branding](05_branding.md)).
**US-F4.1** Given uma OS aberta, Then recebe um número sequencial por tenant (ex.: "OS-41"), exibido em todo card/detalhe/portal, estável e único por oficina.
**Métrica:** operadores referenciam OS por número na fala (qualitativo no piloto).
**Fora de escopo:** numeração fiscal/NF; é identificador interno legível.

---

## F5 — Notificações WhatsApp (M7) · ESCALA, fora do MVP

**Problema:** avisar o cliente a cada estágio sem ele perguntar. **Por que fora do MVP:** RICE Confidence 50% (depende de parceiro/custo de API), Effort 3 sem; **o portal (F2) já mata a ligação de status**. Notificação ativa é amplificador, não prova.
**US-F5.1 (futuro)** Given mudança de estágio relevante, When ocorre, Then o cliente recebe um WhatsApp com link do portal.
**Métrica:** % de clientes que abrem via push; ainda mais redução de ligações.
**Decisão de produto:** só entra com ≥1 piloto pago pedindo + parceiro de envio definido (decisão no M7, [03 EAP](03_architecture.md)).

---

## F6 — Templates de ramo (M8) · ESCALA, fora do MVP

**Problema:** retífica pesada/agro, leve e centro automotivo têm estações/gates/gatilhos diferentes. **Por que fora do MVP:** Effort 3 sem; o MVP valida com **um template fixo**; vira diferencial de escala, não de validação.
**US-F6.1 (futuro)** Given a criação da oficina, When escolhe o ramo, Then o sistema vem com as estações/gates/gatilhos daquele mundo (config por tenant, não tela crua — régua NÃO-É).
**Métrica:** nº de ramos ativos; expansão de contas multi-ramo.
**Decisão:** adiar até ≥1 piloto pago de outro ramo.

---

## F-Resp — Responsabilização do atraso: o pilar (não uma feature solta)

**Problema (evidência verificada):** é o **único espaço em branco** do mercado ([08 §9.2](08_pesquisa_mercado.md)). Já existe parcialmente no código (`culpaDoAtraso` → nossa/cliente/peça em [painel.ts](../src/domain/os/painel.ts); "Bola com a oficina/cliente" em [travamento-selo.tsx](../src/ui/components/travamento-selo.tsx)).

**Decisão de produto:** a responsabilização é o **fio condutor** de F1+F2+F3 — não um item de backlog. Toda tela (painel interno, modo TV, portal do cliente, KPI de atraso) exibe **de quem é a bola**, com o enquadramento CDC (transparência, não isenção).

**US-FResp.1 (já parcialmente feito):** Given uma OS atrasada, Then o painel/portal mostra a culpa (nossa/cliente/peça) com rótulo honesto. **Estado:** KPI de culpa já existe ([page.tsx](../src/app/page.tsx)); o portal (F2) é onde falta levar isso ao cliente.

**Candidata (decidir no SDD) — Histórico de responsabilização:** um resumo tipo "nos últimos 30 dias, 60% do atraso foi peça do cliente". É inédito (nenhum concorrente tem) e transforma postura em dado de relacionamento. **Não dimensionar agora** — avaliar no `/arquitetura` o que o schema/eventos já permitem barato (a linha do tempo da OS já registra transições). Se barato, vira candidata RICE; se caro, fica pós-MVP.

**Fora de escopo F-Resp:** qualquer uso da responsabilização para fins jurídicos/de isenção (proibido, CDC).

---

## F-Simpl — Simplicidade como requisito MENSURÁVEL (não slogan)

**Problema (evidência):** a dor "sistema complicado que a equipe não usa" é a tese do `01`, mas a pesquisa **não conseguiu prová-la contra o líder** ([08 §9.3](08_pesquisa_mercado.md)) — é anedótica. Logo, simplicidade não pode ser slogan; tem que ser **medida**, senão viramos "mais um que diz ser simples".

**US-FSimpl.1 — Adoção de chão mensurável:** Given o uso em piloto, Then medir **% de movimentações de OS feitas por bump na TV/tablet** (chão) vs. por desktop (escritório). Alvo: maioria pelo chão = a equipe de fato usa.

**US-FSimpl.2 — Validação primária (não-negociável antes do GTM):** 3–5 entrevistas com retíficas reais confirmando a dor de adoção e a percepção de responsabilização, **antes** de cravar o pitch ([08 §9.5](08_pesquisa_mercado.md)).

**Regra:** toda nova tela passa pelo "teste do mecânico de mão suja" (usável com luva, do outro lado da oficina). Métrica de complexidade: nº de toques para mover uma OS no chão ≤ 1 (o bump).

---

## Regras de negócio transversais (explícitas, sem ambiguidade)
1. **Gates inegociáveis (RN-01):** não desmonta sem OS aberta; não usina sem orçamento `aprovado`; não passa do CQ sem `cqAprovado`. O sistema barra e **diz o motivo**.
2. **Um orçamento por OS;** recusado pode ser reaberto (`recusado`→`rascunho`) para renegociar.
3. **Recusa volta a OS a diagnóstico;** aprovação **não** avança sozinha (decisão peça vs execução é do chão).
4. **Token do portal:** escopo mínimo (só a própria OS) + expiração; guarda-se o **hash**, nunca o token.
5. **RBAC:** `producao` não edita orçamento; modo leitura no portal interno.
6. **Multi-tenant sempre:** toda leitura/escrita escopada por RLS (`withTenant`); o portal público lê via token sem furar isolamento.
7. **Dinheiro em centavos inteiros;** markup percentual inteiro.
8. **Cor = dado** (sinal + rótulo + posição, nunca cor só); âmbar = marca/risco, nunca status.

## Métricas do PRD (resumo, todas proxy da métrica-mãe)
| Feature | Métrica de sucesso | Alvo (piloto) |
|---|---|---|
| **F2 portal (PRINCIPAL)** | **redução de ligações de status** (baseline vs pós-Igni) | **queda mensurável** |
| F2 portal | orçamentos enviados abertos pelo cliente | ≥60% |
| F2 portal | tempo enviado→decisão | <24h |
| F1 orçamento | OS que passam de "orçamento" com orçamento no Igni | ≥80% |
| **F-Simpl** | **% de movimentações por bump no chão** vs desktop | maioria no chão |
| **F-Simpl** | entrevistas primárias de validação | 3–5 antes do GTM |
| F3 polimento | telas-branca em rede ruim | 0 |
| F4 número OS | referência por número na fala | qualitativo |

## Posicionamento competitivo (pós-pesquisa — o que NÃO liderar no pitch)
- **Higiene competitiva (tablestakes, ficam no MVP, NÃO são manchete):** painel ao vivo, prioridade, aprovação por link, portal — todos já existem no mercado ([08 §3](08_pesquisa_mercado.md)).
- **Manchete de venda (o que é nosso):** responsabilização honesta do atraso (F-Resp, único) + simplicidade que a equipe usa (F-Simpl).
- **Não atacar o Certtus de frente** (reputação limpa); atacar o **status neutro** do mercado.
- **Preço:** premium da simplicidade, acima do piso R$79,90 (Wüst).

## O que está fora de escopo do produto (régua NÃO-É)
ERP fiscal/financeiro completo · tela de configuração crua · pagamento online · chat/anexos no portal · relatórios "poderosos" · **responsabilização usada para isenção de culpa (CDC)** · qualquer feature que não sirva ao relance na parede ou à honestidade do atraso.
