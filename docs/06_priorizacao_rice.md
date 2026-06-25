# Priorização RICE — Igni (backlog M5→M8 + dívidas + auditoria)

> Fase 3 da cadeia. Force-rank do que falta, por **valor de negócio × esforço**. Base para o PRD+SDD.
> Sem Playwright — evidência de código/docs. Meta de negócio que ancora o Impact: ≥15–25 oficinas
> pagantes com churn <3% em 12 meses ([01_conception.md](01_conception.md)).

## Escala (para o ranking ser defensável, não achismo)

- **Reach** — quantos *usos reais* o item toca por ciclo de operação. Escala relativa: 1 (raro/admin) · 3 (recepção/orçamentista) · 5 (todo operador) · 8 (operador **+** cliente final). Cliente final conta dobrado porque é onde mora a queixa nº1 (atraso) e a expansão por painel.
- **Impact** — quanto move a agulha do Business Case por uso. 0.25 (mínimo) · 0.5 · 1 (alto) · 2 (massivo: destrava receita ou mata a dor nº1/nº2).
- **Confidence** — quão certo é o ganho e a estimativa. 50% / 80% / 100%. Itens com domínio já pronto e testado ganham confiança alta.
- **Effort** — pessoa-semana (1 dev assistido por IA). Frações para quick-wins.
- **Score = (Reach × Impact × Confidence) / Effort.**

---

## Tabela RICE (force-ranked)

| # | Item | R | I | C | E | Score | Veredicto |
|---|------|--:|--:|--:|--:|------:|-----------|
| 1 | **M5 — UI do orçamento** (builder peças/mão de obra/terceiro + enviar; gates reais já no domínio) | 8 | 2 | 100% | 0.6 | **26.7** | AGORA |
| 2 | **M6 — Portal do cliente** (token escopo mínimo + stepper tema claro + aprovar/recusar sem login) | 8 | 2 | 90% | 1.5 | **9.6** | AGORA |
| 3 | **P0-1 — Estados loading/erro** (painel, detalhe, TV) | 5 | 1 | 100% | 0.5 | **10.0** | AGORA |
| 4 | **P0-2 — `aria-live` no board ao vivo** | 5 | 0.5 | 100% | 0.2 | **12.5** | AGORA (quick-win) |
| 5 | **P1-1 — Contraste `aco-400`→`aco-300`** (legibilidade AA) | 8 | 0.5 | 100% | 0.2 | **20.0** | AGORA (quick-win) |
| 6 | **P1-3 — Navegação honesta** (`/cadastros` quebrado, Modo TV no shell) | 5 | 0.5 | 100% | 0.3 | **8.3** | AGORA (quick-win) |
| 7 | **Dívida — número sequencial de OS por tenant** | 8 | 1 | 90% | 0.5 | **14.4** | LOGO APÓS |
| 8 | **P0-3 — Overflow/auto-scroll do modo TV** | 3 | 1 | 80% | 0.6 | **4.0** | LOGO APÓS |
| 9 | **Dívida — SMTP/site_url do cloud** (recuperação real em prod) | 3 | 1 | 80% | 0.4 | **6.0** | LOGO APÓS |
| 10 | **P1-4 — Validação inline nos forms** (aria-invalid) | 3 | 0.5 | 100% | 0.5 | **3.0** | LOGO APÓS |
| 11 | **P1-2 — `not-found.tsx` temático** (OS/token inválido) | 3 | 0.5 | 100% | 0.3 | **5.0** | LOGO APÓS |
| 12 | **M8 — Templates de ramo** (estações/gates/gatilhos por tenant) | 5 | 1 | 80% | 3 | **1.3** | DEPOIS |
| 13 | **Dívida — canal privado do realtime** (hardening RLS no tópico) | 5 | 0.5 | 80% | 1 | **2.0** | DEPOIS |
| 14 | **M7 — Notificações WhatsApp** (aviso por estágio) | 8 | 1 | 50% | 3 | **1.3** | DEPOIS (depende de parceiro) |
| 15 | **Dívida — `middleware`→`proxy` (Next 16)** | 1 | 0.25 | 100% | 0.3 | **0.8** | DEPOIS (só aviso hoje) |
| 16 | **Dívida — actions do CI fora do Node 20** | 1 | 0.25 | 100% | 0.2 | **1.3** | DEPOIS (só aviso) |

> Nota de leitura: o **Score** ordena por eficiência. O **Veredicto** aplica também *dependência* e *custo de não fazer* (ex.: o item 2 tem score menor que vários quick-wins, mas é AGORA porque **sem ele o ciclo não fecha** — é o que prova o diferencial).

---

## Top 3 para fazer AGORA

1. **M5 — UI do orçamento (item 1).** Score 26.7, o mais alto. O domínio e os casos de uso já estão prontos e **testados** (confiança 100%, esforço baixo) — falta só a tela. É o que **liga os gates ao dado real** e **destrava a primeira metade do ciclo de receita** (não usina sem orçamento aprovado deixa de ser teórico). Custo de não fazer: o produto trava em "diagnóstico" para sempre.

2. **M6 — Portal do cliente (item 2).** Score 9.6, mas **AGORA por dependência e diferencial**: é onde a queixa nº1 (atraso, "de quem é a bola") vira produto para o cliente final, e onde a **marca clara nasce** (tema claro osso — hoje inexistente, [05_branding.md](05_branding.md)). Fecha a segunda metade do ciclo (aprovar/recusar sem login → destrava execução / volta a diagnóstico). Sem M5+M6, não há MVP vendável.

3. **Quick-wins de confiança (itens 4, 5, 6) + estados (item 3).** Juntos custam <1.5 semana e elevam A11y/legibilidade/navegação — a "honestidade" que a marca promete também é *legibilidade*. O `aria-live` e o contraste tocam todo operador; a navegação honesta remove um link quebrado (`/cadastros`) que mina confiança na demo/piloto.

---

## Pode esperar (logo após o MVP fechar)
- **Número sequencial de OS (7)** — alto Reach e barato; entra junto do M5 se o schema for tocado, senão logo depois. O chão precisa "decorar a OS 41".
- **Overflow do modo TV (8), SMTP cloud (9), validação inline (10), not-found (11)** — melhoram piloto real, mas não bloqueiam vender/demonstrar.

## Cortar/adiar (fora do MVP vendável)
- **M8 Templates de ramo (12)** — caro (3 sem) e o MVP roda com um template fixo; vira diferencial de escala, não de validação. Adiar até ter ≥1 piloto pago pedindo outro ramo.
- **M7 WhatsApp (14)** — Reach alto, mas **Confidence 50%** (depende de parceiro/custo de API) e 3 sem. O portal (M6) já mata a ligação de status; notificação ativa é *nice-to-have* do MVP. Adiar.
- **Canal privado realtime (13), middleware→proxy (15), CI Node 20 (16)** — hardening/manutenção; sem impacto de validação. Backlog técnico.

---

## MVP vendável = o corte

**Entra:** M1–M4 (feito) **+ M5 (UI orçamento) + M6 (portal cliente) + quick-wins de A11y/nav + estados loading/erro + número de OS.**
Isso entrega o **ciclo completo e honesto**: entrada → triagem ao vivo → orçamento → cliente aprova/recusa pelo link vendo de quem é a bola → execução com gates reais → CQ → entrega. É o suficiente para 2–3 pilotos pagantes (critério de validação do Business Case).

**Não entra no MVP:** M7 (WhatsApp), M8 (templates de ramo), hardening técnico. São de **escala**, não de **prova**.

---

## Sequência recomendada (para o PRD/SDD detalhar nesta ordem)
1. **M5 UI orçamento** (+ número de OS se tocar schema)
2. **M6 portal do cliente** (token + tema claro + aprovar/recusar)
3. **Fatia de polimento**: loading/erro + aria-live + contraste + navegação honesta + not-found
4. **Piloto-ready**: SMTP cloud, overflow TV, validação inline
5. **Escala (pós-validação)**: M8 templates, M7 WhatsApp, hardening
