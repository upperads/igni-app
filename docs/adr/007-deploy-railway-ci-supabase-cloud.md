# ADR-007: Deploy & operações — Railway (app) + Supabase cloud (dados) + CI no GitHub

## Contexto
Com o núcleo testado, é preciso o caminho de "código → rodando e observável" (devdead-ops). A
arquitetura é Next.js full-stack (ADR-003) com um serviço dedicado de realtime no futuro, sobre
Postgres+RLS / Auth / Realtime do Supabase (ADR-004). Faltava decidir host do app, pipeline de
qualidade, estratégia de release/rollback e gestão de segredos.

## Decisão
1. **Host do app: Railway** (projeto `igni-app`, workspace pessoal). Containers de longa duração
   se encaixam melhor que serverless no serviço dedicado de realtime (ADR-003) e dão um lugar único
   para app + futuros workers/cron. Deploy a partir do `main`, após CI verde.
2. **Dados: Supabase cloud** (projeto `igni`), região `sa-east-1` (São Paulo). Um único Postgres
   (ADR-006): nossas migrations Drizzle aplicam nele; `auth.users` convive com as tabelas da app.
3. **Migrations: sempre Drizzle** (`drizzle-kit migrate`) contra o `DATABASE_URL` do ambiente.
   Nunca SQL manual em produção; nunca o sistema de migration do Supabase em paralelo (ADR-005).
4. **CI: GitHub Actions** por push/PR no `main` — build → lint → typecheck → testes (com Postgres
   efêmero p/ integração/RLS) → checagem de migrations. **Sem merge no `main` com pipeline vermelho.**
5. **Segredos**: nos secrets do Railway/Supabase, nunca no repo nem em logs de CI.
6. **Faseamento**: infra **provisionada agora**, primeiro deploy real **depois** (o app ainda não
   tem login/2FA). Runbook do 1º deploy no `00_status.md`.

## Alternativas consideradas
- **Vercel** (host natural de Next.js): ótimo, mas serverless complica o serviço de realtime
  persistente (websockets) que o ADR-003 prevê. Railway roda o processo contínuo sem ginástica.
- **VPS próprio**: mais controle, muito mais ops para um fundador solo. Descartado.
- **Sistema de migration do Supabase**: descartado em favor de um único tooling (Drizzle, ADR-005).

## Consequência
- **Bloqueio atual**: o limite de **2 projetos free ativos** por conta no Supabase impede criar o
  `igni` cloud sem antes pausar um projeto ativo ou dar upgrade de org para Pro. Decisão de billing
  do dono; documentado como pendência no `00_status.md`.
- **Rollback**: Railway mantém deploys anteriores (redeploy do anterior). Migrations seguem
  **forward-fix** (corrigir para frente com nova migration), não down-migrations automáticas.
- **Atenção na migração para o Supabase hospedado**: o papel de conexão não é superusuário, então
  o `SET LOCAL ROLE app_user` (ADR-005) pode exigir `GRANT app_user TO <role de conexão>`. Validar
  no primeiro `db:migrate` contra o cloud.
- CI verde é pré-condição de merge; o pipeline já roda no GitHub (verificado).
