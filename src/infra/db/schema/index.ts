// Barrel do schema Drizzle. Cada tabela vive em seu próprio arquivo e é reexportada aqui.
// Toda tabela nova nasce com `tenant_id` + política RLS na MESMA migration (regra de ouro
// do CLAUDE.md / ADR-001). A US-01 adiciona `tenant` e `usuario`.
export {};
