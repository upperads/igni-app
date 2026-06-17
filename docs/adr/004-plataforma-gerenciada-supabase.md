# ADR-004: Supabase como plataforma gerenciada (Postgres+RLS, Auth, Realtime)

## Contexto
A Fase 3 fixou os **padrões** (Postgres+RLS, pub/sub para o painel, auth gerenciada com 2FA,
WhatsApp por integração) mas deixou a **escolha de fornecedor** em aberto. O produto é um MVP de
fundador solo: a prioridade é foco no produto, não em ops (justificativa da camada de Infra). Os
requisitos que mais pesam na largada são RNF-SEC-03 (isolamento multi-tenant via RLS),
RNF-SEC-04 (2FA admin) e RNF-PERF-01 (propagação realtime < ~2s).

## Decisão
Adotar **Supabase** como plataforma gerenciada única para a camada de dados, autenticação e
tempo real:
- **Postgres gerenciado + RLS** — materializa o ADR-001 sem operar banco.
- **Supabase Auth** com **MFA/TOTP** — atende RNF-SEC-01/02/04 (2FA admin) sem construir auth.
- **Supabase Realtime** — canal pub/sub para os painéis de setor (ADR-002, RNF-PERF-01).
- Dev local com **Supabase CLI** (stack em Docker) para paridade com produção.

Cobre 3 dos 4 fornecedores em aberto numa só conta. WhatsApp (RF-10) permanece em aberto e será
decidido no módulo M7.

## Alternativas consideradas
- **Best-of-breed (Neon + Clerk + Ably/Pusher)**: mais desacoplado e menos lock-in, porém 3
  contratos/integrações e mais cola — custo e tempo maiores para um fundador solo no MVP. Adiável
  se a escala exigir trocar uma peça.
- **Auth self-host (Auth.js/NextAuth)** + Postgres puro: menos lock-in, mas joga 2FA, recuperação
  de conta e lockout para o nosso código — mais superfície de risco de segurança. Descartado para
  a largada.
- **Realtime caseiro (LISTEN/NOTIFY + gateway WS próprio)**: viável, mas é mais um serviço para
  operar; o Realtime gerenciado entrega o alvo <2s sem isso.

## Consequência
Menos ops e velocidade no MVP; RLS, 2FA e realtime atendidos por uma plataforma. O **padrão**
(Postgres+RLS, pub/sub, auth gerenciada) continua firme e o lock-in é mitigável: é Postgres puro
(migrations versionadas, portáveis) e auth por padrões abertos (JWT/TOTP). O caminho de extração
do ADR-003 permanece aberto. Exige disciplina de manter segredos fora do código (env) e a estratégia
de enforcement de RLS definida no ADR-005.
