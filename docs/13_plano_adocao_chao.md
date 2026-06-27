# Plano — Adoção do Chão (a resposta ao Régis) + WhatsApp da recepção

> Documento de DECISÃO, antes de código. Nasce do campo ([entrevista_simulada](entrevista_simulada_igni.md),
> [voz_do_mercado](voz_do_mercado_igni.md)). O campo reordenou a prioridade: **o risco nº1 não é falta
> de cadastro — é o chão não adotar.** A pergunta mais afiada do entrevistado foi:
> *"por que a equipe do barracão vai usar o SEU se não usou o Certtus?"* Este plano responde isso com
> mecânica, não slogan. Régis também descreu do portal e ancorou preço em R$100–150 — logo, **portal
> congelado, WhatsApp barato no lugar, e foco no chão.**

## 0. A tese de adoção (o "porquê vão usar")
O Certtus falhou no chão por um motivo nomeado pelo Régis: **"muita tela, muito campo, e o cara é
mecânico, não digitador."** A resposta do Igni não é "somos mais simples" (todo mundo diz isso). É uma
restrição de design **inegociável** para a tela de chão:

> **No chão, mover uma OS custa NO MÁXIMO 1 toque. Zero digitação. Zero formulário. Zero busca.**

Se qualquer ação de chão exigir digitar algo, ela falhou a tese. A recepção/gestão digita; o barracão só
**bate** (bump). É a diferença entre "o sistema do escritório" e "o sistema do chão".

---

## 1. Fatia 1 — Tela de chão por estação (`/chao`)

### O que é
Uma superfície dedicada, **separada do board do gestor**, pensada para o tablet/TV de uma estação:
- Mostra **só as OS daquela estação** (não a oficina inteira; o mecânico do cabeçote não quer ver bloco).
- Cards **enormes** (legível de luva, a um braço de distância), pouco texto: OS-nº, equipamento, há quanto tempo está ali (cronômetro), e de quem é a bola se travado.
- **Um botão gigante por card: "PRONTO →"** que avança a OS para a próxima etapa (o bump). 1 toque. Confirmação visual (o card sai), e pronto.
- Se a próxima etapa ramifica/é gated, o card **não** oferece o toque cego: mostra "precisa de decisão" e manda pro detalhe (raro no chão).

### O que falta no modelo de dados (honesto)
Hoje a OS **não é atribuída a uma estação** (`os.estacao_id` existe na tabela mas nunca é preenchido — verificado). Para a tela de chão "por estação" existir, precisamos:
- **Atribuir a OS a uma estação** quando ela entra em execução (ou um mapeamento estado→estação por template).
- **Decisão de modelagem (a resolver na implementação):** ou (a) o operador/recepção escolhe a estação atual da OS, ou (b) cada `estado` da máquina mapeia para uma estação default do template. Recomendo começar **simples**: a tela de chão agrupa por **estado** (que já existe e já é a "estação lógica" da linha), e a atribuição física a `estacao_id` fica para quando o cadastro de Estações (plano 12) existir. **Assim a Fatia 1 não depende do cadastro de estações** — usa os estados que já temos.

➡️ **Decisão: Fatia 1 = tela de chão por ESTADO** (aberta/diagnóstico/execução/CQ…), não por `estacao_id`. Entrega o valor (chão move com 1 toque) sem bloquear no cadastro de estações. A granularidade física (estações dentro de execução) entra depois, com o cadastro.

### Acesso (a decisão que o dono delegou)
**Trade-off:** rastreabilidade ("quem moveu") vs. atrito zero (o mecânico não quer login).

| Opção | Prós | Contra |
|---|---|---|
| A — Sessão do produtivo (papel `producao`, sem 2FA) | Reusa o RBAC e o login que existem; registra **quem** moveu (auditoria/evento) | O mecânico tem que logar uma vez no tablet (atrito inicial pequeno) |
| B — Token/PIN por estação (como o portal) | Atrito zero; o tablet abre o board e fica | **Perde o "quem moveu"** (o evento fica anônimo); e é uma 2ª superfície pública a proteger |

➡️ **Recomendação: A (sessão do produtivo).** Motivos: (1) o login é **uma vez** no tablet da estação e fica logado (sessão por cookie já persiste); (2) preserva a auditoria (o `evento` já grava `por_usuario_id` — o Régis quer saber quem avançou); (3) reusa RBAC `producao` que **já existe e já só permite `os:avancar`** (o chão não vê orçamento, não mexe em preço). O atrito de "logar uma vez" é trivial perto do ganho de auditoria. O PIN por estação fica como evolução SE o campo pedir.

### Por que isto responde o Régis
- "Muita tela" → **uma** tela, **um** botão.
- "O cara é mecânico, não digitador" → **zero digitação**.
- "Voltou pro quadro branco" → o card É o quadro branco, mas que se atualiza sozinho e some quando termina.
- "Quem moveu?" → registrado (auditoria), sem custar atrito ao mecânico.

---

## 2. Fatia 2 — WhatsApp da recepção (sem integração paga)

### A correção de rota (o campo mandou)
Régis: *"meu cliente é mecânico, não menininho de app, metade não abre o link."* E o portal de status **já existe por R$79–97**. Então **não** construímos a integração WhatsApp paga (M7, caro, parceiro, e o campo não validou pagar). Fazemos o barato que ataca a dor real:

> A recepção **já manda zap o dia todo.** O Igni gera a **mensagem pronta** (estágio + de quem é a bola + link opcional) e abre o WhatsApp dela com **1 clique** (`https://wa.me/<numero>?text=<msg>` — link nativo, zero API, zero custo).

### O que entrega
- Alivia a recepção (a filha do Régis, 1h30/dia respondendo "ficou pronto?").
- A **responsabilização vai escrita e honesta** no zap ("Aguardando a peça que você vai enviar") — a prova que o Régis hoje cata em prints de 3 semanas atrás.
- Respeita "o cliente não abre app": a mensagem chega **onde ele já está**.
- **Custo de engenharia: baixíssimo** (montar texto + `wa.me`). Sem M7.

### Enquadramento CDC (o contra-sinal de H2)
A `voz_do_mercado` alertou: o cliente lê "a culpa é sua" como a oficina se blindando. Então a mensagem **nunca** acusa; comunica **estado e dependência**: *"Seu motor está aguardando a peça que você vai mandar — assim que chegar, seguimos."* Transparência, não acusação. (Mesma regra do portal.)

---

## 3. Fatia 3 — QR por OS na bancada (reforço, depois)
Cada OS ganha um QR imprimível (cola na bancada/no motor). O produtivo aponta o celular → abre direto **aquela OS** na tela de chão, já no botão de avançar. Remove até o "achar o card". É reforço da tese (atrito ainda menor), mas depende da Fatia 1 existir. Entra como 2ª fatia.

---

## 4. O que este plano NÃO faz (disciplina)
- **Não** constrói M7 WhatsApp (API/parceiro) — o `wa.me` resolve barato; M7 só com validação de que pagam.
- **Não** investe mais no portal — congelado (funciona, é higiene).
- **Não** começa pelos cadastros (Equipe/Estações do plano 12) — eles dão contexto, mas não atacam o risco nº1. Entram depois, e a tela de chão por ESTADO nem depende deles.

## 5. Sequência
1. **Fatia 1 — tela de chão `/chao` por estado** (cards enormes, bump 1 toque, sessão do produtivo). O coração.
2. **Fatia 2 — WhatsApp da recepção** (`wa.me`, mensagem pronta com responsabilização CDC-safe).
3. **Fatia 3 — QR por OS** (reforço).

---

## 7. Integração da estratégia do dono (saída estratégica completa)

> O dono trouxe uma estratégia que ELEVA este plano. Incorporada aqui, com uma ressalva de engenharia
> onde o risco técnico pede. Onde divergimos, está dito por quê.

### 7.1 O FLYWHEEL de adoção (o pulo do gato — adotado)
Ligar a ação mínima do chão ao valor máximo do dono: **mover a fase (1 toque) → o cliente recebe um
update honesto automático no WhatsApp → menos ligação na recepção + atraso documentado pro dono.** Um
toque do mecânico gera o maior valor do sistema. É isto que faz pegar — não a tela bonita.

➡️ **Decisão:** o flywheel começa pelo **TOQUE** (quiosque), não pelo áudio. Motivo de engenharia: "áudio
move a fase" = STT + parse de linguagem natural + risco de **mover a OS errada** (3 Gols no chão?), o que
quebraria a confiança do chão — o oposto do objetivo. E WhatsApp-**in** real exige a **API oficial paga**
(M7, que o campo não validou pagar). O `wa.me` é **out** (mensagem pronta), de graça. O áudio/IA entra
como **exploração paralela P2**, com **confirmação obrigatória antes de mover** (nunca move cego).

### 7.2 Reenquadrar o que o CLIENTE vê (o conserto de risco mais importante — adotado)
O `voz_do_mercado` provou: cliente lê "a culpa é sua" como a oficina se blindando. A correção do dono:
**honestidade SIMÉTRICA.** O que muda na superfície do cliente (portal + mensagem WhatsApp):
- "De quem é a bola" some do que o cliente vê. Vira **"Status do serviço / linha do tempo"** com **fatos
  carimbados no tempo**: *aguardando aprovação do orçamento*, *aguardando peça que você vai enviar*,
  *em execução (2 dias)*, *aguardando peça do fornecedor*. A "culpa" emerge dos fatos; a retífica nunca acusa.
- **Mostra a espera dos DOIS lados** (a da oficina igual à do cliente). É a honestidade contra si mesmo que
  faz o cliente acreditar quando a espera é dele.
- **Culpa vira call-to-action:** quando depende do cliente, aparece o botão que destrava — *"Aprovar
  orçamento"*, *"Confirmar envio da peça"*. Não é cobrança, é utilidade.
- **"De quem é a bola" continua INTERNO** (painel do dono + tela de chão) — lá o dono quer o placar.

➡️ **Decisão:** aplicar junto da Fatia 2 (WhatsApp-out), numa mexida só na superfície do cliente.

### 7.3 Modelo de negócio (adotado como norte, não como código agora)
- **Companheiro do Certtus, não substituto** (derruba o "trocar vs. andar junto" do Régis).
- **Entrar barato na commodity** (linha do tempo + portal + WhatsApp), **cobrar pela inteligência:**
  o **Relatório de Bola** mensal + **painel de ROI do dono** (horas de telefone poupadas, % de atraso fora
  da alçada). É a camada que justifica preço acima do piso R$79–97. Vira **P1 (o vendável)**.
- **Preço flat por retífica, nunca por usuário** (por usuário → o dono limita acesso → o chão não usa).

### 7.4 Backlog reordenado (com a estratégia)
- **P0 (adoção + desarma risco):** Fatia 1 quiosque de chão · Fatia 2 WhatsApp-out + reenquadramento da
  superfície do cliente (linha do tempo honesta dos 2 lados + botões de destravar).
- **P1 (vendável):** Relatório de Bola mensal exportável · Painel de ROI do dono.
- **P2 (fosso/exploração):** WhatsApp-in por áudio com IA (confirmação obrigatória) · QR por OS ·
  benchmark anônimo entre retíficas · templates por seção.

### 7.5 Narrativa de venda (a ordem importa — adotada)
Abrir por *"seu chão finalmente atualiza, e o cliente para de ligar, pelo WhatsApp que vocês já usam"*;
depois *"e no fim do mês você tem, preto no branco e sem brigar, de quem foi o atraso"*. **Nunca** abrir
pelo portal (é o que o concorrente de R$79 já faz).

### 7.6 Métrica de morte (o teste do Régis)
**% de avanços de fase feitos pelo CHÃO (quiosque) vs. escritório.** Se a maioria vier do chão em 1 mês de
piloto → a tese venceu. Se voltou pro quadro branco em 2 semanas → a resposta veio, e é não. Mensurável
com um marcador de origem no evento (a adicionar).

## 6. Como saber se funcionou (a métrica do Régis)
A prova não é a tela bonita. É o que o Régis disse no fechamento: **"bota na mão dos meus sete cara por um mês e vê se usam sem eu ficar no pé."** Métrica = **% de avanços de etapa feitos pela `/chao` (chão) vs. pelo detalhe/desktop (escritório).** Se a maioria vier do chão, a tese de adoção venceu. Isso já é mensurável (o evento registra quem/por onde, com um marcador de origem a adicionar).
