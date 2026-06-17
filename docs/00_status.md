# Status — PRONTO (codinome; marca a definir)

- **Modo**: greenfield
- **Fase atual**: **Execução (devdead-exec) em andamento.** Inception (Fases 1–4) completa e aprovada. **Wave 1 (fundação) CONCLUÍDA e commitada.**
- **Aprovado até**: Fases 1, 2 e 3 aprovadas em 16/06; stack do M1 fechada em 17/06 (ADR-004/005)
- **Próximo passo**: **Checkpoint 1 aguardando aprovação do usuário.** Em seguida: **Wave 2 — US-01 schema-first (TDD)**: migration `tenant`+`usuario` com `tenant_id` + RLS FORCE; teste de isolamento A↛B (RED→GREEN); caso de uso criar oficina + admin + template.
- **Execução — ondas**:
  - Wave 1 (fundação) ✅ — Next.js 16 + TS strict + Tailwind + ESLint; camadas domain/application/infra/app; Drizzle + Postgres local (docker-compose, porta 5433) + `igni_test`; Vitest. Tudo verde (typecheck/lint/test/build); drizzle conecta. Commits `a168a66`, `6b7497e`, `a4f8dcb`.
  - Wave 2 (US-01) — próxima.
  - Wave 3 (US-02/US-03 + Supabase local p/ Auth) — pendente.
- **Ambiguidades abertas** (não bloqueiam o handoff):
  - Marca/nome (codinome PRONTO; finalistas Igni/Torq; falta checar domínio/INPI)
  - Metas numéricas de sucesso e faixas de preço — calibrar
  - Uptime alvo — a definir
  - Validar contraste da paleta de sinal sobre grafite (WCAG) na implementação
  - Fornecedores: **resolvido** — Supabase (Postgres+RLS+Auth+Realtime, ADR-004) + Drizzle (ADR-005). **WhatsApp** ainda em aberto → decide no M7.
- **ADRs registrados**: 001 (Postgres+RLS), 002 (painel realtime), 003 (MVP full-stack Next), **004 (plataforma Supabase)**, **005 (Drizzle + enforcement RLS)** — em `/docs/adr/`
- **Housekeeping 16/06**: removidas 4 cópias duplicadas de `00_status`; ADRs movidos de `/docs/` para `/docs/adr/`
- **devdead-audit**: roda na validação/implementação (ainda não há código)
- **Última atualização**: 16/06
