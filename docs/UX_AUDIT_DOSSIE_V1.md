# Dossiê de Auditoria UX/UI — Igni V1

- **Data**: 2026-06 · **Produto**: Igni (igni-app) — sistema operacional de oficina sob encomenda
- **Estágio**: M4 em produção (painel + realtime); M5 (orçamento) em curso, pausado
- **Prod**: https://igni-app-production.up.railway.app
- **Método**: auditoria por **evidência de código** (não Playwright — restrição do projeto, CLAUDE.md). Cada achado cita arquivo/rota como prova; "não encontrado no código" quando falta evidência. Espírito `devdead-audit`.

## Pedido em 1 frase
Avalie 0–100 em 6 dimensões (Sistema visual · UX core · Polish · A11y · Microcopy · Confiabilidade) e sugira quais correções priorizar.

## O que é o produto
Board escuro de controle para oficinas de retífica: painel de triagem em tempo real nas TVs de setor + status do serviço para o cliente com responsabilização. Diferenciais: **visibilidade honesta** (as 4 perguntas, a culpa do atraso separada), **triagem por razão crítica** (prazo ÷ trabalho restante + gatilhos), **gates inegociáveis** (não usina sem orçamento aprovado), **multi-tenant com RLS**.

## Rúbrica 0–100 (avaliação interna, calibrar com especialista)

| Dimensão | Nota | Justificativa (evidência) |
|---|---:|---|
| **Sistema visual** | 86 | Tokens coesos e com intenção: grafite quente + sinal de 5 cores + âmbar estrutural ([globals.css](../src/app/globals.css)). Par tipográfico placa+instrumento ([layout.tsx](../src/app/layout.tsx)). Falta o tema claro do portal (só o token `--osso-50` existe; nenhuma tela usa). |
| **UX core** | 80 | Fluxos reais e diretos (abrir OS, bump, triagem, painel). Mas há **lacunas de estado** (loading/erro/overflow) e a navegação não reflete tudo que existe (sem link p/ Cadastros real, "Modo TV" só na Home). |
| **Polish** | 74 | Microinterações boas (bump com `useTransition`, realtime ao vivo/reconectando). Faltam: skeleton de loading, toast de sucesso do bump, animação de saída do card (prometida no 03b). |
| **A11y (WCAG 2.2 AA)** | 78 | Forte: foco âmbar visível global, `role="alert"`/`role="status"`, cor+rótulo nunca só cor, alvo ≥48px. Riscos: **contraste do texto `aco-400` sobre grafite** a validar; ícones-emoji sem rótulo textual em alguns selos; sem `aria-live` no board que muda sozinho. |
| **Microcopy** | 88 | PT-BR consistente, calmo e didático (anti-IA). Bom tratamento de erro sem vazar segurança (recuperação de senha). Pequenas inconsistências de rótulo (ver achados). |
| **Confiabilidade** | 72 | Realtime best-effort + indicador de reconexão é maduro. Mas **estados de erro/vazio faltam em telas-chave** e o board do modo TV é snapshot sem auto-scroll de overflow (prometido no 03b). |

**Global ponderado: ~80/100.** Base sólida e com identidade; o que separa de "excelente" é cobrir os 6 estados por tela e fechar a dívida de A11y de contraste/aria-live.

## Inventário visual (telas × evidência × nota rápida)

| Tela | Evidência | Nota |
|---|---|---|
| Painel geral (Home) | [page.tsx](../src/app/page.tsx) | KPIs + manchete da culpa + board por etapa, cards com bump. Forte. Falta loading/erro. |
| Modo TV | [painel/tv/page.tsx](../src/app/painel/tv/page.tsx) | Tela cheia, read-only, relógio, contadores, ao vivo. Falta auto-scroll de overflow e skeleton. |
| Triagem | [triagem/page.tsx](../src/app/triagem/page.tsx) | Fila ordenada + selo travamento + prioridade. Empty state bom. |
| OS — lista | [os/page.tsx](../src/app/os/page.tsx) | Lista + empty state cuidado. OK. |
| OS — detalhe | [os/[id]/page.tsx](../src/app/os/%5Bid%5D/page.tsx) | 4 perguntas, timeline, ações (bump/recall), triagem. Densa, sem `notFound` custom. |
| OS — abrir | [os/nova/form.tsx](../src/app/os/nova/form.tsx) | Form com fieldsets. Sem feedback de campo inválido inline além do erro global. |
| Login | [login/form.tsx](../src/app/login/form.tsx) | Limpo, lockout, links. OK. |
| 2FA | [login/2fa/dois-fatores.tsx](../src/app/login/2fa/dois-fatores.tsx) | Enroll/challenge com QR + chave. Bom; loading textual simples. |
| Criar conta | [criar-conta/form.tsx](../src/app/criar-conta/form.tsx) | Medidor de força, sucesso claro. OK. |
| Recuperar / Atualizar | [recuperar/form.tsx](../src/app/recuperar/form.tsx) · [atualizar-senha/form.tsx](../src/app/atualizar-senha/form.tsx) | Não revela existência de conta; erro de 2FA bem explicado. OK. |
| Primeiros passos | [primeiros-passos/page.tsx](../src/app/primeiros-passos/page.tsx) | Guia numerado com espinha, copy calma. Forte. |

## Achados priorizados (RICE)

### 🔴 P0 — afetam o uso real agora
- **P0-1 · Estados ausentes (loading/erro) no painel e detalhe.** O board (`/`, `/painel/tv`) e o detalhe não têm skeleton nem tratamento de falha de leitura; em rede ruim o operador vê tela em branco. O 03b exige os 6 estados ([03b §Painel](../docs/03b_design.md)). Evidência: nenhuma `loading.tsx`/`error.tsx` em `src/app/**` (não encontrado no código). *RICE alto: Reach todos os operadores × Impact alto × Conf alta / Effort 1.*
- **P0-2 · Board que muda sozinho sem `aria-live`.** O `RealtimePainel` dá `router.refresh()` e os cards mudam, mas não há região `aria-live` anunciando ("OS-X avançou"). Leitor de tela no chão não percebe. Evidência: [realtime-painel.tsx](../src/app/_components/realtime-painel.tsx) só troca o pill ao vivo/reconectando. *Effort 0.5 (quick-win).*
- **P0-3 · Overflow do modo TV sem auto-scroll.** Com muitas OS a coluna estoura a tela da TV always-on; o 03b pede rolagem/auto-scroll. Evidência: [painel/tv/page.tsx](../src/app/painel/tv/page.tsx) usa grid estático sem overflow tratado.

### 🟠 P1 — alto valor
- **P1-1 · Contraste de `aco-400` (#8b919e) sobre grafite-800/900 a validar (WCAG AA 4.5:1).** É a cor de quase todo texto secundário/rótulo. Evidência: uso massivo de `text-aco-400` em quase todos os componentes. Precisa medição; provável reprovação em texto pequeno. *Quick-win se subir 1 tom.*
- **P1-2 · `notFound()` do detalhe sem página custom.** [os/[id]/page.tsx](../src/app/os/%5Bid%5D/page.tsx) chama `notFound()`, mas não há `not-found.tsx` temático — cai no genérico. Idem token expirado (M6 ainda não existe).
- **P1-3 · Navegação incompleta/inconsistente.** `app-shell` lista "Cadastros" → `/cadastros` que **não existe** (não encontrado no código), e "Modo TV" só aparece na Home, não no shell. Evidência: [app-shell.tsx](../src/ui/components/app-shell.tsx) NAV.
- **P1-4 · Erros de validação só globais nos forms.** Abrir OS / criar conta mostram um erro no rodapé, sem marcar o campo (`aria-invalid`/mensagem por campo). Evidência: [os/nova/form.tsx](../src/app/os/nova/form.tsx), [criar-conta/form.tsx](../src/app/criar-conta/form.tsx).

### 🟡 P2 — backlog
- **P2-1 · Código da OS é hash do id (`refCurta`)** — humano não decora "a1b2c3d4". Falta número sequencial por tenant. Evidência: [composition/os.ts](../src/infra/composition/os.ts) `refCurta`.
- **P2-2 · Selos usam emoji (⏸) sem texto alternativo consistente.** [travamento-selo.tsx](../src/ui/components/travamento-selo.tsx). Risco de leitura por TalkBack/VoiceOver.
- **P2-3 · Sem skeleton/transição no 2FA e nas trocas de modo** ([dois-fatores.tsx](../src/app/login/2fa/dois-fatores.tsx) — "carregando" textual).
- **P2-4 · Toast de sucesso do bump prometido no 03b** ("OS-2041 → CQ") **não existe**; hoje o card só some no refetch.

## Estado conhecido (transparência)
- ✅ Entregue: design system (tokens+fontes), AppShell desktop/mobile, painel real + modo TV, triagem, OS (lista/detalhe/abrir), bump+recall, realtime, auth completa (login/2FA/recuperação), primeiros passos. ADRs 001–010.
- ⏳ Em curso (pausado, não commitado): **M5 orçamento** — domínio + casos de uso testados; **UI do orçamento e o portal do cliente (tema claro) ainda não existem**.
- 🔧 Resíduos já mapeados: número sequencial de OS, canal privado do realtime, SMTP/site_url do cloud, `middleware`→`proxy` (Next 16), actions do CI fora do Node 20.

## 5 perguntas para input direcionado
1. O `aco-400` como cor de texto secundário passa AA no seu olhar, ou subimos para `aco-300` (a criar)?
2. No modo TV always-on, auto-scroll vertical contínuo ou paginação por etapa a cada N segundos?
3. Vale um número de OS sequencial por tenant agora (afeta schema) ou o hash basta no MVP?
4. O board ao vivo deve anunciar mudanças por voz (`aria-live`) ou isso polui em oficina barulhenta?
5. O portal do cliente (tema claro) entra no fluxo desta cadeia (M6) ou fica para depois do PRD/SDD?

## Próximos passos sugeridos (quick-wins primeiro)
1. **P0-2 + P1-1 + P1-3** são quick-wins (Effort ≤0.5): `aria-live` no board, subir 1 tom o texto secundário, limpar a navegação. Atacáveis em uma fatia.
2. `loading.tsx`/`error.tsx`/`not-found.tsx` temáticos (P0-1, P1-2).
3. Overflow/auto-scroll do TV (P0-3).
