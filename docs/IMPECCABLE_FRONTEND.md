# Impeccable — Craft Review do Front-end (Igni)

> Olhar de craft/polish: o que separa "competente" de "impecável e memorável". SEM Playwright —
> evidência de código. Cruza branding ([05](05_branding.md)), design spec ([03b](03b_design.md)),
> UX V2 ([UX_AUDIT_DOSSIE_V2.md](UX_AUDIT_DOSSIE_V2.md)). Aplica as leis de design (cor OKLCH, tema
> com cena física, tipografia, motion, e os **bans absolutos**).

## Veredicto de craft
**Competente com identidade real — ainda não impecável.** O Igni já escapa do clichê de dark-mode SaaS
(grafite quente ≠ azul-neon; sinal de 5 cores que É dado; âmbar estrutural). Isso é raro e bem-feito. O
que falta para "impecável" não é reforma: é **precisão** (cor em OKLCH e contraste), **ritmo** (espaçamento
varia pouco), **micro-interação** (o board "pisca" no refetch em vez de transicionar) e, principal, **uma
decisão honesta sobre a assinatura** (ver o ⚠️ abaixo — há um conflito real com uma lei de design).

---

## ⚠️ O conflito que precisa de decisão (não dá pra ignorar)
**A "espinha de status" é um side-stripe border — um ban absoluto da disciplina de craft.** A lei: *"Side-stripe
borders: `border-left`/`border-right` >1px como acento colorido em cards. Never intentional."* E a assinatura
do Igni é exatamente isso: a faixa lateral grossa colorida no `OsCard` ([os-card.tsx:22](../src/ui/components/os-card.tsx))
e o branding a chama de "o único elemento memorável" ([05 §6](05_branding.md)).

**Minha leitura (honesta, não dogmática):** o ban existe porque o side-stripe quase sempre é **decorativo e
preguiçoso**. No Igni ele é **funcional e semântico** (a cor É a triagem, lida à distância na TV) — é a exceção
que a regra mira proteger, não o alvo. **Mas** a forma atual (faixa de 6px) é a execução mais óbvia possível,
e é o que faz "parecer template". **Recomendação: manter o conceito (cor de status na borda do card é válido
para um board industrial), elevar a execução** para não ser o stripe genérico:
- Em vez da faixa chapada, considerar a cor **invadindo** o card (gradiente curtíssimo da borda para dentro,
  ~12px, baixando a opacidade) + um **tick/entalhe** no topo — vira "instrumento", não "borda colorida".
- Ou: a espinha como **barra de cronômetro** que esvazia conforme o prazo (a cor + o nível contam duas coisas).
  Isso transforma o ban num diferencial. → **decisão de design a tomar antes do portal** (a coerência depende disso).

---

## Achados priorizados (craft)

### 🔴 Craft-bloqueante para "impecável"
**CR-1 · Cor não está em OKLCH; neutros são hex puros tendendo a frio.** [globals.css:10-33](../src/app/globals.css)
usa hex (`#14161a`…). A lei: OKLCH, e **tintar todo neutro na direção da marca** (âmbar) com chroma 0.005–0.01.
Hoje o grafite é "quase neutro frio" — contra o próprio branding que pede "grafite QUENTE". O olho sente, mas
o código não entrega.
  **Fix:** migrar tokens para `oklch()`, dar aos grafites um leve viés âmbar (h≈70, c≈0.008), reduzir chroma do
  sinal nos extremos. É o que faz o board parecer "fundido a quente" e não "cinza de dashboard".

**CR-2 · Contraste do texto secundário reprova/ aco-300 inexistente.** (= P1-1 da UX V2, mas aqui é craft: ) `aco-400`
(#8b919e) sobre grafite-800/900 fica perto do limite AA, e **a distância da TV** (modo TV) o secundário some.
  **Fix:** criar `aco-300` (OKLCH, L mais alto), usar no secundário do board e no modo TV usar **um degrau acima**
  (a 3m de distância, "perto do limite" vira ilegível). Craft = legibilidade na cena real (luva, TV, oficina).

### 🟠 Eleva muito o polish
**CR-3 · O board "pisca" no realtime — não transiciona.** O ping faz `router.refresh()`
([realtime-painel.tsx](../src/app/_components/realtime-painel.tsx)) → re-render seco. O design 03b promete
"card anima a saída e some da coluna; toast curto". Hoje: salto.
  **Fix:** ao mover/bump, animar a saída do card (opacity+translate, ease-out-quart, sem layout property) e um
  toast discreto "OS-41 → CQ". Não animar `height`/`top`; usar transform. É o que dá sensação de "vivo".

**CR-4 · Ritmo de espaçamento é monótono (`gap-3`/`p-3`/`p-4` em quase tudo).** A lei: variar spacing para ritmo.
O board, a triagem e o detalhe usam quase o mesmo passo — fica "competente, plano".
  **Fix:** escala de espaçamento com contraste (ex.: seções respiram em 8/12, conteúdo denso em 2/3); o KPI e a
  manchete do atraso merecem mais ar que a lista. Dá hierarquia sem mudar conteúdo.

**CR-5 · A responsabilização (o pilar) é visualmente tímida.** "De quem é a bola" é o diferencial (pesquisa
[08](08_pesquisa_mercado.md)), mas aparece só como `TravamentoSelo` discreto e uma linha de KPI. Craft-wise,
**o que é o coração do produto tem que ser o que mais salta.**
  **Fix:** tratar a responsabilização como elemento de 1ª classe — no card atrasado, um marcador claro
  "BOLA: CLIENTE / OFICINA / PEÇA"; no detalhe, um bloco; no portal, o herói. Não é mais dado, é **mais ênfase**.

### 🟡 Detalhes que somam
**CR-6 · Selos com emoji (⏸) e densidade de badges.** [travamento-selo.tsx](../src/ui/components/travamento-selo.tsx)
usa emoji (renderiza diferente por OS/fonte) e o detalhe empilha 3 badges (estado+prioridade+travamento) com o
mesmo peso → competem. **Fix:** ícone SVG próprio (consistente) + hierarquia entre badges (um primário, outros sutis).
**CR-7 · `KpiStat` beira a "hero-metric template" (número grande + label).** A lei bane o template. Salva-se porque
há 4 lado a lado e a manchete do atraso quebra o padrão — mas está no limite. **Fix:** dar ao KPI de atraso um
tratamento distinto (não só `manchete`), ex. a culpa inline no próprio bloco, pra não ser "4 cards iguais".
**CR-8 · Sem estados de loading/erro (= P0-1 UX).** Craft: a ausência de skeleton faz o board "saltar" no load.
**Fix:** skeleton com o ritmo do board (não spinner genérico).

---

## Direção de craft para o PORTAL (M6 — tema claro, ainda inexistente)
É a superfície de maior risco de virar genérica. Direção para nascer impecável e coerente:

**Cena física (a lei manda escrever):** *"o dono de um caminhão, no pátio, no sol, abrindo no celular o link
que a oficina mandou — quer saber em 3 segundos se já pode buscar e, se atrasou, de quem é a culpa."* Essa cena
força: **tema claro de alto contraste sob sol** (não o creme-clichê de SaaS), **mobile-first**, **uma resposta
dominante** (o estágio + a bola), zero navegação.

- **Cor:** NÃO o "osso + verde/teal de healthcare" (reflexo de categoria). Manter o `osso` quente como fundo, mas
  o acento é o **mesmo âmbar estrutural da marca** (continuidade com o board) + o sinal de 5 cores para o estágio.
  OKLCH, contraste AA forte (sol no celular).
- **Stepper de estágio:** não o stepper genérico de checkout (bolinhas numeradas). Fazer "instrumento": uma régua
  horizontal com a etapa atual marcada pelo sinal, as 4 perguntas como legenda ("onde / por quê / o que falta /
  pra onde"). Tipografia placa (Saira) nos rótulos = continuidade com o board.
- **Cartão de responsabilização (o herói):** um bloco grande, honesto, sem rodeio: *"A bola está com você: falta a
  peça que você vai enviar"* / *"A bola está com a oficina"*. Âmbar quando é do cliente (chama ação), neutro quando
  é da oficina (transparência, não vergonha). **É o que nenhum concorrente tem — tem que ser a coisa mais bonita da tela.**
- **CTA aprovar/recusar:** botões grandes (mesmo alvo de toque do bump), sem modal; confirmação inline.
- **Bans a respeitar no portal:** sem gradient-text, sem glassmorphism, sem modal, sem hero-metric. Sem em dash na copy.

---

## O que separa "competente" de "impecável" aqui (resumo)
1. **Precisão de cor** (OKLCH + grafite quente de verdade + contraste de TV) — CR-1, CR-2.
2. **Movimento que conta a verdade** (transição no realtime/bump, não pisca) — CR-3.
3. **Ênfase no pilar** (responsabilização salta) — CR-5.
4. **Decisão sobre a assinatura** (elevar a espinha de status acima do side-stripe genérico) — ⚠️.
5. **Ritmo** (espaçamento com hierarquia) — CR-4.

Nada disso bloqueia marchar no M5 backend (gate + orçamento). Mas **CR-1/CR-2 e a decisão da assinatura
deveriam ser feitas antes do M6 portal**, senão o tema claro nasce incoerente com um board que ainda vai mudar.

## Recomendação de sequência (com a UX V2)
- **Junto da 1ª fatia do M5:** os 3 quick-wins da V2 (nav honesta, `aco-300`/contraste = CR-2, error/loading = CR-8).
- **Antes do M6 portal:** CR-1 (OKLCH), decisão da assinatura (⚠️), CR-5 (responsabilização proeminente).
- **Polish contínuo:** CR-3 (motion), CR-4 (ritmo), CR-6/CR-7.

---

## ✅ Pago antes do portal (craft pass pré-M6)
- **CR-1 (OKLCH)** — `globals.css` migrado para `oklch()`: grafites quentes de verdade (hue ~75, chroma 0.006–0.012), aço com fio de calor, sinal de 5 cores calibrado (chroma contido, "fosco" não neon). Lightness controla o contraste (AA na TV).
- **⚠️ Assinatura resolvida** — a espinha de status deixou de ser side-stripe chapado: agora é **linha de instrumento nítida (2px) + sangria curta da cor para dentro** do card via `color-mix(in oklch, …)`. Conceito mantido (cor=triagem), execução elevada (gauge, não "borda colorida"). `SINAL` ganhou `cor` (CSS var) para o gradiente. `OsCard` reescrito (sem o ban).
- **CR-5 (responsabilização proeminente)** — o pilar agora salta no board: card travado mostra **"BOLA: CLIENTE/OFICINA"** (âmbar quando é do cliente = ação; neutro quando é da oficina = transparência) no lugar do genérico "Travado". Propagado Home + modo TV.
- *Pendente (polish contínuo, não bloqueia o portal):* CR-3 (motion do realtime), CR-4 (ritmo de espaçamento), CR-6/CR-7 (selos/KPI).
- *Verificação:* typecheck/lint/build + 103 testes verdes. **Resultado visual a confirmar no navegador** (sem Playwright; OKLCH + color-mix são CSS moderno, suportado nos browsers atuais).
