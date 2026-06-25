# Dossiê de Auditoria UX/UI — Igni V2 (re-tour pré-dev)

- **Data**: 2026-06 · **Produto**: Igni (igni-app) · **Estágio**: M1–M4 em prod; M5 em retomada
- **Objetivo da V2**: decidir se a **base de front-end se sustenta** para construir M5 (UI orçamento) e
  M6 (portal) em cima. Re-tour da [V1](UX_AUDIT_DOSSIE_V1.md), **verificado contra o código atual** (grep/leitura).
- **Método**: SEM Playwright — evidência de código. Cada status abaixo foi **verificado**, não presumido.

## Veredicto (responde a pergunta do dono)
**A base SE SUSTENTA. Pode marchar com M5/M6** — com uma ressalva de sequência: **3 quick-wins** deveriam
entrar **junto** da primeira fatia de UI (não antes, não depois), porque o M5/M6 vão *replicar* os mesmos
buracos se eles não forem fechados agora. Não há dívida visual estrutural que bloqueie; o design system é
coeso e os componentes são reutilizáveis. O que falta é **cobertura de estados** e **higiene de A11y/nav** —
barato e localizado.

## Delta da rúbrica (V1 → V2)
Nenhuma mudança de código de UI desde a V1 (a sessão foi blueprint/docs). Logo, **as notas se mantêm** —
mas o **contexto mudou**: agora sabemos pela pesquisa que a responsabilização é o pilar, então a dimensão
"UX core" ganha um critério novo (a culpa do atraso tem que estar legível e onipresente).

| Dimensão | V1 | V2 | Δ | Por quê |
|---|---:|---:|:--:|---|
| Sistema visual | 86 | 86 | = | Tokens coesos; tema claro do portal ainda só token (`--osso-50`) |
| UX core | 80 | 78 | ▼2 | Régua nova: a responsabilização precisa ser pilar visível (hoje é um selo só) |
| Polish | 74 | 74 | = | Sem mudança; faltam skeleton/toast/anim |
| A11y | 78 | 78 | = | `aria-live` e contraste ainda abertos |
| Microcopy | 88 | 88 | = | Continua forte e anti-IA |
| Confiabilidade | 72 | 72 | = | Estados de erro/loading ainda ausentes |

**Global ~79/100** (era ~80). A leve queda é a régua nova de marca, não regressão de código.

## Status dos achados V1 (verificado no código)
| Achado V1 | Status V2 | Evidência |
|---|---|---|
| **P0-1** loading/erro states | 🔴 **ABERTO** | `find src/app -name loading.tsx -o -name error.tsx` → **nenhum** |
| **P0-2** `aria-live` no board ao vivo | 🔴 **ABERTO** | `grep aria-live src/` → **nenhum** |
| **P0-3** overflow/auto-scroll modo TV | 🔴 ABERTO | [painel/tv/page.tsx](../src/app/painel/tv/page.tsx) grid estático |
| **P1-1** contraste `aco-400`→`aco-300` | 🔴 **ABERTO** | `grep aco-300 globals.css` → **não existe**; só 100/200/400 |
| **P1-2** `not-found.tsx` temático | 🔴 ABERTO | `find ... not-found.tsx` → **nenhum** |
| **P1-3** nav aponta p/ `/cadastros` inexistente | 🔴 **ABERTO (link morto)** | nav [app-shell.tsx:11](../src/ui/components/app-shell.tsx) → `/cadastros`; rota **não existe** |
| **P1-4** validação inline nos forms | 🔴 ABERTO | forms com erro global só ([os/nova/form.tsx](../src/app/os/nova/form.tsx)) |
| **P2-1** código de OS = hash (`refCurta`) | 🔴 ABERTO | [composition/os.ts:181,252](../src/infra/composition/os.ts) — vira ADR-011 |
| **P2-2/3/4** emoji nos selos / 2FA loading / toast bump | 🔴 ABERTO | sem mudança |

**Resumo:** **0 resolvidos, 0 regressões, todos abertos.** Esperado — a cadeia foi de planejamento. O dado
útil aqui é: **nada piorou**, e a lista da V1 segue válida e priorizada.

## Novo na V2 (à luz do branding/pesquisa)
- **N-1 · A responsabilização precisa virar elemento de 1ª classe, não um selo.** Hoje "de quem é a bola"
  aparece só no `TravamentoSelo` e no KPI de atraso. Como é **o** diferencial (pesquisa [08](08_pesquisa_mercado.md)),
  a UI do M5/M6 deveria torná-lo proeminente (no card, no detalhe, no portal). É decisão de UX, não bug.
- **N-2 · O portal (M6) é uma superfície visual NOVA (tema claro) sem nenhum componente pronto.** Stepper,
  cartão de responsabilização, layout claro — tudo a criar. **Risco:** construir o portal "na correria" e
  ele destoar do craft do board escuro. Recomendo desenhar os componentes do portal com o mesmo rigor (é o
  que a `/impeccable` a seguir vai endereçar).

## O que pagar ANTES/JUNTO do M5 (não depois)
**3 quick-wins (Effort ≤0.5 cada), porque o M5/M6 vão replicar o buraco:**
1. **P1-3 nav honesta** — remover/criar `/cadastros` + "Modo TV" no shell. Link morto numa demo de piloto é vexame barato de evitar.
2. **P1-1 `aco-300`** — criar o token e trocar texto secundário. A UI de orçamento vai ter MUITO texto secundário (itens, valores) — nascer já legível.
3. **P0-1 loading/erro** — pelo menos um `error.tsx` raiz + `loading.tsx` no painel/detalhe. A UI de orçamento faz I/O (salvar/enviar) — precisa de estado de erro desde o nascimento.

**Pode esperar a fatia F3 dedicada:** P0-2 aria-live, P0-3 overflow TV, P1-2 not-found, P1-4 validação inline, P2-*.

## Inventário (sem mudança vs V1 — telas que o M5/M6 tocam)
| Tela | Para M5/M6 | Nota |
|---|---|---|
| `/os/[id]` | recebe a **seção Orçamento** (M5) | densa mas organizada; base ok para somar a seção |
| `/` painel | recebe responsabilização proeminente (N-1) | sólida |
| `/portal/[token]` | **não existe** (M6) | superfície nova, tema claro — maior risco de craft |

## Próximo passo
`/impeccable` para o olhar de craft (hierarquia, micro-interação, o que falta pra não ser genérico) —
especialmente mirando os **componentes do portal (tema claro)** que vão nascer no M6.
