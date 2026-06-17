# CLAUDE.md — PRONTO (codinome; marca a definir)

> Arquivo de governança na raiz. É a primeira coisa que o agente de código lê.
> Mantenha-o vivo: atualize a cada decisão arquitetural ou mudança de padrão.

## Contexto do projeto
PRONTO é um SaaS multi-tenant: o **sistema operacional de uma oficina sob encomenda** (retíficas
pesada/agro e leve, e centros automotivos). Entrega um **painel de triagem em tempo real** nas TVs
de setor + **status do serviço para o cliente com responsabilização**. Diferencial: visibilidade
honesta e enxuta, não mais um ERP. Ver Business Case em `/docs/01_conception.md`.

## Stack e padrões (regras rígidas)
- **Linguagem/framework**: Next.js + TypeScript strict (zero `any`). MVP full-stack (ADR-003).
- **Banco**: PostgreSQL com **Row-Level Security** por tenant (ADR-001), via Prisma (migrations versionadas) — Drizzle é alternativa aprovada.
- **Tempo real**: pub/sub (push) para os painéis, alvo < 2s (ADR-002).
- **Domínio desacoplado**: a lógica de negócio (máquina de estados, triagem) vive separada da camada web, para extração futura de serviços e para testabilidade.
- **Convenções de pasta**: `/src` com domínio (regras), aplicação (casos de uso/API), infra (DB/integrações) e UI separados.
- **Estilo**: Clean Code, SOLID, lint estrito.

## Regras de ouro
1. **O macro manda no micro**: nada que desvie do Business Case (`/docs/01`) ou da Arquitetura (`/docs/03`) sem consultar.
2. Ler os `/docs` (`01`→`04`) antes de implementar qualquer feature.
3. Implementar **uma User Story por vez, schema do banco primeiro**.
4. Não quebrar o que funciona — rodar o build/testes após cada fatia.
5. Toda mudança arquitetural fecha com um **ADR** em `/docs/adr`.
6. **Gates inegociáveis**: não desmonta sem OS aberta; não usina sem orçamento aprovado; não entrega sem CQ.
7. **Isolamento multi-tenant sempre**: toda tabela nova tem `tenant_id` + política RLS na mesma migration; todo acesso é testado contra vazamento entre tenants.

## Testes (parte da Definition of Done)
- **Unidade**: máquina de estados, razão crítica, lógica dos gates, regra da vez.
- **Integração**: rotas + DB, com **teste obrigatório de isolamento multi-tenant**.
- **E2E**: ciclo da OS (entrada→entrega) e aprovação do cliente pelo link.

## Segurança (RNFs gravados no SRS — `/docs/02`)
RBAC; 2FA para admin; threshold de tentativas configurável; criptografia em trânsito/repouso;
token do link do cliente de escopo mínimo + expiração; LGPD para placa/chassi/cliente
(mascaramento em logs e telas). Honrar pelos docs mesmo sem a skill de segurança presente.

## Design (tokens e regras em `/docs/03b_design.md`)
Board escuro de controle (grafite + paleta de sinal de 5 cores + âmbar de segurança estrutural);
portal do cliente em tema claro. Triagem nunca depende só de cor (cor + rótulo + posição). Alvo de
toque grande para "bump" com luva. WCAG 2.2 AA.

## Decisões fixo vs configurável
- **Configurável** (env/DB/painel, sem novo deploy): threshold de login; estações/gates/gatilhos por template; pesos da razão crítica e SLAs; feriados (tabela/API); token/expiração do link; preços/planos.
- **Datas/fusos**: sempre UTC/ISO 8601; converter por localidade.
- **Fixo**: paginação técnica (ex.: 20/página).

## Workflow de commits
Conventional commits por módulo da EAP: `feat(os): ...`, `feat(painel): ...`, `feat(auth): ...`,
`feat(triagem): ...`, `feat(orcamento): ...`, `feat(portal): ...`, `feat(templates): ...`.

## Mapa de documentos
- `/docs/00_status.md` — estado atual (ler primeiro ao retomar)
- `/docs/01_conception.md` — Business Case + Canvas
- `/docs/02_definition.md` — PRD + SRS
- `/docs/03_architecture.md` — Stack + ERD + API + EAP
- `/docs/03b_design.md` — Design system + spec por tela
- `/docs/04_execution.md` — Backlog + critérios de aceite + handoff
- `/docs/adr/` — registros de decisão (001 RLS, 002 realtime, 003 full-stack)
