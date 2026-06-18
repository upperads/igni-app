# ADR-006: Arquitetura de autenticação (Supabase Auth + RLS por tenant)

## Contexto
US-02 (login + 2FA admin + lockout) e US-03 (RBAC) precisam de uma decisão de como o Supabase
Auth (ADR-004) se integra ao modelo de domínio (`usuario`, `papel`, `tenant`) e à RLS (ADR-005)
sem quebrar o isolamento multi-tenant. A Fase 3 deixou em aberto: mapeamento identidade↔perfil,
origem do `tenant` na sessão, mecanismo de lockout (o GoTrue só oferece rate-limit por IP/tempo,
não um lockout por-conta com N configurável — RNF-SEC-05) e o enforcement de 2FA por papel.

## Decisão
1. **Um único Postgres = o do Supabase.** As migrations Drizzle aplicam no banco do Supabase; o
   schema `auth` (gerido pelo GoTrue) convive com as tabelas da app. Dev local via Supabase CLI
   (Docker). O Postgres do `docker-compose` (porta 5433) fica só para testes rápidos sem auth.
2. **Mapeamento identidade↔perfil:** `usuario` ganha `auth_user_id uuid` único, referência lógica
   a `auth.users.id`. A senha e o MFA vivem no GoTrue; `usuario` é o perfil da app (papel, tenant,
   nome). O onboarding (`criarOficina`) cria a identidade no Supabase Auth **e** o perfil, ligados.
3. **Sessão → tenant:** após o login (cookies via `@supabase/ssr`), resolve-se o `usuario` pelo
   `auth_user_id` → `tenant_id` + `papel`; o acesso a dados segue por `withTenant(tenant_id)`. A
   RLS **não muda** — continua dirigida por GUC server-side (ADR-005). O `tenant_id` nunca vem do
   cliente; é derivado do perfil autenticado.
4. **2FA (RNF-SEC-04):** MFA TOTP do Supabase Auth. Papéis administrativos (`dono`, `gestor`)
   precisam atingir **AAL2** (fator enrolado e verificado) — barrado no middleware/guards. Demais
   papéis: 2FA opcional.
5. **Lockout (RNF-SEC-05):** contador **próprio** de tentativas por conta (tabela), bloqueio após
   **N configurável** (env/DB), com mensagem clara e janela de reset. Não depender do rate-limit
   nativo, que não cumpre o requisito como escrito.
6. **RBAC (US-03):** `papel` governa a autorização server-side (produção não edita orçamento;
   campos read-only por papel). A UI reflete, mas a checagem é no servidor.

## Alternativas consideradas
- **RLS via JWT/PostgREST (supabase-js no core):** o tenant viria de claim no token e o PostgREST
  aplicaria a política. Amarraria o acesso a dados ao cliente Supabase e atrapalharia o domínio
  desacoplado (ADR-003). Fica reservado ao **portal público** (token de escopo mínimo, M6).
- **Auth self-host (Auth.js):** já descartado no ADR-004 (joga 2FA/recuperação/lockout pro nosso
  código). Mantido o Supabase.
- **Lockout só com rate-limit do GoTrue:** mais simples, mas não é lockout por-conta com N
  configurável — não cumpre RNF-SEC-05. Descartado.
- **Dois bancos (app + auth separados):** impediria ligar `usuario` a `auth.users` e exigiria
  sincronização frágil. Descartado em favor do Postgres único do Supabase.

## Consequência
O `criarOficina` passa a ter um efeito colateral externo (criar identidade no Auth) — precisa de
compensação/atomicidade cuidadosa (se a criação do perfil falhar, desfazer a identidade). O alvo
do `DATABASE_URL` de dev passa a ser o Postgres do Supabase. Surge a tabela de tentativas de login
(com `tenant_id` + RLS, como toda tabela). O middleware passa a exigir AAL2 para admin. A RLS e o
contrato do `withTenant` permanecem intactos — a auth alimenta o `tenant_id`, não o substitui.
