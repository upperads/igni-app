// Barrel do schema Drizzle. Cada tabela vive em seu próprio arquivo e é reexportada aqui.
// Regra de ouro (CLAUDE.md / ADR-001): toda tabela com dado de tenant nasce com `tenant_id`
// + política RLS na mesma leva de migration. As políticas/role vivem na migration custom
// `0001_rls_*` (ADR-005), aplicadas via `SET LOCAL` no helper `withTenant`.
export * from "./enums";
export * from "./tenant";
export * from "./usuario";
export * from "./estacao";
export * from "./tentativa-login";
export * from "./cliente";
export * from "./equipamento";
export * from "./entrada";
export * from "./os";
export * from "./evento";
export * from "./ajuste-prioridade";
export * from "./orcamento";
export * from "./orcamento-item";
export * from "./tenant-contador-os";
export * from "./quiosque-setor";
export * from "./servico";
export * from "./cargo";
export * from "./tela";
