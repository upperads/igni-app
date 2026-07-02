# Branding — Igni

> Fase 2 da cadeia. Estratégia de marca ancorada no que o código JÁ PROVA (não em mood board).
> Método: evidência de código (sem Playwright). Naming não é reaberto aqui — fica para o fim.
> Teste de rigor aplicado: **se trocar o nome "Igni" e a identidade continuar funcionando igual, está genérica.** Onde isso acontece, está marcado.
>
> **⚠️ Revisado pós-pesquisa de mercado ([08](08_pesquisa_mercado.md)).** A pesquisa provou que painel ao vivo,
> prioridade, aprovação por link e portal do cliente são **commodity** (Certtus, Wüst a R$79,90, Tekmetric,
> KDS já têm). O único espaço em branco verificado é a **responsabilização honesta do atraso** — *ninguém*
> no mercado atribui "de quem é a bola" (OnlineOS, o mais focado em atraso, explicitamente não atribui culpa).
> O branding abaixo foi ajustado: a inimiga não é "ninguém tem visibilidade" (têm), é **o status neutro que
> esconde de quem é a bola**. E a responsabilização deixou de ser um detalhe — é o **pilar**.

---

## 1. A verdade estratégica (de onde tudo sai)

O mercado não sofre de falta de software. Sofre de **software que a equipe não usa**. A reclamação nº1 do setor é literal: *"sistema complicado que a equipe não usa e que não resolve o problema real"* ([01_conception.md](01_conception.md)). E a queixa nº1 do cliente final é o **atraso** — hoje respondido por ligação.

Quase todo concorrente responde a isso prometendo **mais**: mais módulos, mais relatórios, mais poder. O Igni responde com **menos, mas honesto**. Esse é o eixo. Não é um diferencial de feature — é uma postura, e ela já está cravada no produto:

- **Honestidade radical sobre o atraso**: o sistema separa a culpa (nossa / cliente / peça) e mostra de quem é a bola — inclusive quando a bola é da própria oficina. Evidência: `culpaDoAtraso` ([src/domain/os/painel.ts](../src/domain/os/painel.ts)), `RESPONSABILIDADE_ROTULO` "Bola com a oficina / Bola com o cliente" ([travamento-selo.tsx](../src/ui/components/travamento-selo.tsx)).
- **As 4 perguntas, sempre**: toda OS responde onde está / por que parou / o que falta / pra onde vai. Evidência: `quatroPerguntas` ([estado.ts](../src/domain/os/estado.ts)).
- **Gates inegociáveis**: não usina sem orçamento aprovado; não passa do CQ sem aprovação. O sistema **barra e diz o motivo** — não deixa o humano furar a regra. Evidência: `validarTransicao` ([estado.ts](../src/domain/os/estado.ts)).
- **Prioridade que não mente**: a razão crítica calcula a urgência real; a "regra da vez" ajusta a fila sem falsear o número. Evidência: ADR-009, `ordenarFila` ([triagem.ts](../src/domain/os/triagem.ts)).

Marca, aqui, é a tradução dessa postura em território, voz e forma.

---

## 2. Território de marca

**Território: "Visibilidade honesta do chão."** Com um eixo afiado pela pesquisa: **a honestidade do atraso — inclusive a nossa.**

Não "gestão", não "produtividade", não "transformação digital" — esses funcionam para qualquer ERP (teste da rename: falham). E, depois da pesquisa, "visibilidade ao vivo" sozinha também falha: **o mercado todo já tem painel** (Certtus, Wüst, Produttivo). O território específico e **verificadamente não-ocupado** do Igni é mais estreito e mais forte: **tornar visível, sem maquiar, de quem é a bola quando algo para** — incluindo a parte incômoda (o atraso é nosso).

Por que esse território e não outro:
- **É o único espaço em branco comprovado** ([08 §9.2](08_pesquisa_mercado.md)): nenhum concorrente — nem o OnlineOS, focado em atraso — atribui responsabilidade do atraso. Todos mostram "status neutro".
- **É defensável**: nasce de uma decisão de produto que o concorrente legado não copia sem se renegar (ERPs existem para registrar, não para expor a própria conta).
- **É sentido por dois públicos de uma vez**: o dono vê o gargalo real; o cliente final para de ligar porque enxerga de quem é a bola.
- **Já existe no código** (`culpaDoAtraso` em `painel.ts`). Não é aspiração de marca — é descrição do que o sistema faz, e ninguém mais faz.

**A inimiga (reposicionada pós-pesquisa):** não é a planilha (invisível) nem "o Certtus é ruim" (não é — Reclame Aqui limpo, não dá pra atacar). **A inimiga é o status neutro que esconde de quem é a bola.** "Em andamento" e "aguardando peça" são meias-verdades confortáveis para a oficina. O Igni conta a verdade inteira.

**Antiterritório (o que o Igni recusa):** o "tudo-em-um poderoso". O Igni não compete em quantidade de módulos (o Certtus ganha aí). Quando tiver que escolher entre uma feature a mais e uma tela mais legível na parede, escolhe a tela.

> **Cuidado jurídico que é também de marca (CDC):** responsabilização é **transparência, não isenção de culpa**. Juridicamente, a oficina responde pelo atraso mesmo quando a peça do cliente atrasou (o veículo está em sua posse — [08 §4.1](08_pesquisa_mercado.md)). A marca diz "você vê o estado real e de quem depende o próximo passo", **nunca** "a culpa é do cliente, não nossa". Honestidade que constrói confiança — não que terceiriza culpa.

---

## 3. Posicionamento

**Para** a oficina sob encomenda (retífica pesada/agro, leve, centro automotivo) que perdeu o controle do chão e está cansada de status que não diz a verdade,
**o Igni é** o sistema operacional do chão que mostra, ao vivo e sem maquiar, onde cada serviço está **e de quem é a bola quando para**,
**diferente do** Certtus/ERPs (que mostram status neutro) e da planilha (invisível),
**porque** foi feito para um relance na TV do setor — não para um operador de ERP — e é o único que **responsabiliza o atraso** (oficina/cliente/peça) em vez de só dizer "em andamento".

> Posicionamento de preço ([08 §9.5](08_pesquisa_mercado.md)): o piso do mercado é R$79,90 (Wüst). O Igni **não disputa preço** — disputa "a equipe usa + a verdade do atraso". **Premium da simplicidade**, acima do commodity, abaixo da complexidade do Certtus.

**Contra quem se posiciona (e o gancho) — revisado pós-pesquisa:**
| Alternativa | Realidade (verificada) | Gancho do Igni |
|---|---|---|
| Certtus (líder, completo) | Tem painel, portal, aprovação, garantia. Reputação limpa. **Mas mostra status neutro, não responsabiliza** | "Eles te mostram que atrasou. A gente te mostra **de quem é a bola** — e fala isso de honesto." |
| Mass-market (Wüst R$79,90, Oficina Integrada, Syscar) | Painel/portal como add-on; foco em OS+financeiro | "Não é o mais barato. É o que a equipe **de fato usa** na parede." |
| Planilha / caderno / WhatsApp | Serviço órfão, invisível | "O chão inteiro num relance — e a verdade do atraso." |

> Nota de pitch ([08 §9.3](08_pesquisa_mercado.md)): **não atacar o Certtus de frente** ("ruim/ninguém usa") — não é provável e a reputação dele é limpa. Atacar o **comportamento do mercado** (status neutro), não o concorrente.

---

## 4. Promessa e mantras

**Promessa (uma frase):** *Você sabe, num relance, onde cada serviço está — e de quem é a bola.*

**Mantras internos (governam decisões de produto e copy):**
1. **"O atraso é a manchete."** — já é o texto do painel ([page.tsx](../src/app/page.tsx)). Não escondemos a má notícia; damos destaque a ela.
2. **"De honesto, não de bonito."** — clareza ganha de enfeite. Cor é dado (sinal de 5 cores), não decoração.
3. **"O macro manda no micro."** — nada entra que não sirva ao relance na parede.
4. **Teste do mecânico de mão suja** — se ele não consegue usar com luva, do outro lado da oficina, não está pronto.

---

## 5. Identidade verbal (tom de voz)

**Tom: capataz experiente e calmo.** Quem já viu a oficina pegar fogo e fala devagar porque sabe o que está fazendo. **Direto sem ser seco; didático sem ser bobo; honesto sem ser cru.** Nunca o "assistente animadinho" de SaaS.

Já é o tom adotado (anti-IA, calmo) — ver [primeiros-passos](../src/app/primeiros-passos/page.tsx) e o estilo de escrita registrado. Esta seção o **codifica** para escalar.

**Regras verbais:**
- **PT-BR sempre.** Português de chão de oficina, não de consultoria.
- **Frase com sujeito e fôlego.** Evitar a prosa picotada de IA (sequência de frases curtíssimas) e o travessão em tudo.
- **Nomear a coisa pelo nome do chão**: "bola com o cliente", "a vez", "travado", "bump". Não "stakeholder", "pipeline", "sincronizar".
- **A má notícia primeiro, com calma.** "Atrasou. A peça é que não chegou — e quem pediu foi o cliente."
- **Verbo no imperativo gentil para ação**: "Abra a OS", "Veja como começar, com calma".

**Mostra, não conta** (exemplos PT-BR):

| Situação | ❌ Genérico / IA | ✅ Igni |
|---|---|---|
| Empty state do painel | "Nenhum dado disponível no momento." | "Nenhuma OS ativa na casa. Quando um equipamento entrar, abra a OS — e ela aparece aqui, na etapa certa." |
| Gate barrado | "Ação não permitida." | "Não dá pra usinar: o orçamento ainda não foi aprovado." |
| Atraso por peça do cliente | "Status: atrasado." | "Atrasou. Faltou a peça — e quem ia mandar é o cliente. A bola está com ele." |
| Erro de rede no board | "Erro de conexão." | "Reconectando… mostrando o último estado que vimos." (já é o texto — [realtime-painel.tsx](../src/app/_components/realtime-painel.tsx)) |
| Onboarding | "Bem-vindo! Vamos começar sua jornada 🚀" | "Primeiros passos no Igni. Sem pressa: dá pra fazer a primeira OS hoje." |

**Glossário de marca (termos que são nossos):** as 4 perguntas · a vez (regra da vez) · a bola (de quem é) · bump · travado · razão crítica · gate · a manchete (o atraso). Esses termos **são** o produto; usá-los consistentemente é o que faz a marca não ser genérica.

---

## 6. Direcionamento visual (refina o que existe, não reinventa)

A identidade visual já tem fundamento forte ([globals.css](../src/app/globals.css), [03b_design.md](03b_design.md)). O branding **ratifica e endurece** — não troca paleta por moda. Cada decisão abaixo tem razão estratégica; nenhuma é "transmite modernidade".

### O sistema (e por que ele é a marca)
- **Grafite quente, não preto frio** (`#14161a`→`#3a3f4b`). Fundamento: é o board de controle de um lugar onde se trabalha com metal e óleo — quente, não o "dark mode SaaS" genérico. *(Rename test: passa — essa decisão é da oficina, não de qualquer app.)*
- **Sinal de 5 cores É o dado** (vermelho/laranja/amarelo/verde/azul, foscos). Fundamento: a cor carrega informação de triagem, nunca enfeita. Regra inegociável: **cor + rótulo + posição**, nunca cor sozinha (daltonismo/WCAG). Evidência: `StatusPill`, `EstadoBadge`, `PrioridadeBadge`.
- **Âmbar é a marca e o risco — nunca status** (`#f2a93d`). Fundamento: o âmbar é a assinatura (wordmark IGNI) e o alarme estrutural (trilho de risco a 45°), o "alarme periférico visível do outro lado da oficina". Separá-lo do sinal de status é o que mantém a leitura limpa. Evidência: `.trilho-alarme` ([globals.css](../src/app/globals.css)), `RiskRail`.
- **Par tipográfico placa + instrumento**: Saira Condensed (display, "placa de equipamento") + Spline Sans Mono (cronômetros/código, "leitura de instrumento") + Archivo (corpo). Fundamento: a tela tem que se ler como um painel industrial, não como um dashboard de marketing. Evidência: [layout.tsx](../src/app/layout.tsx).

### A assinatura (o elemento memorável)
**Espinha de status + trilho de risco.** A faixa lateral grossa na cor da triagem em cada card + as listras de hazard âmbar a 45° no topo quando há crítico/atraso. É o único elemento que alguém lembra depois — e é funcional, não decorativo. **Defender isso é defender a marca.**

### Dois mundos, uma marca
- **Interno = board escuro de controle** (operação, TV, chão). Denso, instrumental, alto contraste.
- **Portal do cliente = tema claro "osso" quente** (`#f7f6f3`), calmo, com a responsabilização em âmbar. Fundamento: o cliente não opera nada — ele precisa de calma e de uma resposta ("de quem é a bola"). O contraste de temперatura entre os dois mundos é proposital. ⚠️ **Hoje só existe o token** `--osso-50`; nenhuma tela clara foi construída (não encontrado no código). O portal é onde a marca ainda precisa nascer — entra no M6.

### Refinos que o branding recomenda (vindos da auditoria V1)
1. **Criar `aco-300`** (um tom acima do `aco-400` atual) para texto secundário — fechar a dívida de contraste AA sem perder a paleta. É decisão de marca: legibilidade é parte da "honestidade".
2. **Número de OS legível** (sequencial por tenant) no lugar do hash — o chão precisa "decorar a OS 41", não "a1b2c3d4". A marca fala a língua do chão.
3. **Selos com rótulo textual, não só emoji** (⏸) — consistência e acessibilidade.

---

## 7. O que o Igni É / NÃO É (régua de decisão)

| O Igni É | O Igni NÃO É |
|---|---|
| O sistema operacional do **chão** | Um ERP fiscal/financeiro (isso entra por integração) |
| Honesto sobre o atraso, inclusive o nosso | Um maquiador de status |
| Lido num relance, na parede, com luva | Uma ferramenta de operador sentado |
| Opinativo por templates de ramo | Uma tela configurável crua |
| Cor = dado | Cor = enfeite |
| Calmo e direto | Animadinho e jargão de SaaS |

**Como usar esta régua:** toda feature, tela ou texto novo passa pela coluna esquerda. Se só couber na direita, não é Igni.

---

## 8. Naming + slogan (FECHADO — 01/07/2026)

O naming foi reaberto no fim da cadeia (como planejado) e **decidido**.

**Nome/raiz: `Igni`** — mantido. Fundamento: (1) sonoro, curto, energético (do latim *ignis*, ignição/fogo) e fácil de falar no chão; (2) **único no setor** — o campo competitivo é um mar de "Oficina X / Motor Y / Ultracar / MinhaOficina" (todos falham no rename test, intercambiáveis); "Igni" destaca de longe; (3) zero migração (já está no código, deploy e na retífica-piloto). A crítica válida — "sozinho não diz o que entrega" — é resolvida pelo **slogan**, não por trocar o nome.

**Formato (a decidir vendo a landing):** três candidatos vivos, a escolher quando o hero estiver montado com cada um:
- **Igni puro** + slogan (recomendado do estrategista: mais limpo, cresce melhor, um nome só).
- **Igni Prumo** — composto com a régua da verdade ("no prumo" = em ordem); autoexplicativo.
- **Igni Pulso** — composto com o batimento ao vivo; energético, diz "tempo real".

**Slogan de trabalho (a refinar com a landing):**
> **Sua oficina inteira num relance. E a verdade de cada atraso.**

Vende para o **dono** (quem compra), nos dois ângulos que ele escolheu: *visão do todo num relance* + *honestidade do atraso como prova*. **Regra de conversão vinda da pesquisa** ([voz_do_mercado](voz_do_mercado_igni.md) §H2): o slogan NUNCA vende "mostre a culpa ao cliente" — o consumidor lê atribuição de culpa como a oficina se blindando. A responsabilização é **prova interna que faz o dono confiar no dado**, não arma contra o cliente. Variantes para A/B guardadas: "O sistema que o chão realmente usa — e que te mostra tudo." · "Você vê onde cada serviço está. Sem adivinhar, sem ligar, sem maquiar."

**Nomes descartados (e por quê):** a linha "nome novo puro" (Prumo, Pulso, Vigia, Talha, Compasso, Cume…) foi explorada e todos verificados **livres no setor de software de oficina** — mas o dono optou por **manter Igni** (preferência + a força de já estar no ar). Ficam arquivados como fonte para submarca/módulos.

## 9. Conexão com as próximas fases
- **Landing / funil (próxima frente)**: montar o hero com Igni puro vs. Igni Prumo vs. Igni Pulso para **decidir o formato vendo**; refinar a tagline; estruturar landing → signup → app com base no que os concorrentes fazem.
- **PRD/SDD**: o território "visibilidade honesta" e a régua É/NÃO-É seguem priorizando o backlog.
