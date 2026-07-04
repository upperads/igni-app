-- Seed dos cargos-semente (P-1): para CADA tenant existente, cria os 7 cargos de sistema e liga
-- cada usuário ao cargo correspondente ao seu papel atual. Idempotência não é necessária (migration
-- roda uma vez), mas o WHERE NOT EXISTS protege contra reexecução acidental em dev.

-- Dono: todas as permissões atribuíveis + cargo:gerir é implícito (não listado aqui). exige_2fa.
INSERT INTO "cargo" (tenant_id, nome, sistema, chao, permissoes, exige_2fa)
SELECT t.id, 'Dono', true, false,
  ARRAY['os:abrir','os:editar','os:avancar','triagem:override','orcamento:editar','dinheiro:ver','dinheiro:ver_peca','cadastro:editar','equipe:gerir','config:editar'],
  true
FROM "tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "cargo" c WHERE c.tenant_id = t.id AND c.nome = 'Dono');--> statement-breakpoint

INSERT INTO "cargo" (tenant_id, nome, sistema, chao, permissoes, exige_2fa)
SELECT t.id, 'Gestor', true, false,
  ARRAY['os:abrir','os:editar','os:avancar','triagem:override','orcamento:editar','dinheiro:ver','dinheiro:ver_peca','cadastro:editar','equipe:gerir','config:editar'],
  true
FROM "tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "cargo" c WHERE c.tenant_id = t.id AND c.nome = 'Gestor');--> statement-breakpoint

INSERT INTO "cargo" (tenant_id, nome, sistema, chao, permissoes, exige_2fa)
SELECT t.id, 'Recepção', true, false,
  ARRAY['os:abrir','os:editar','os:avancar','orcamento:editar','dinheiro:ver','cadastro:editar','triagem:override'],
  false
FROM "tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "cargo" c WHERE c.tenant_id = t.id AND c.nome = 'Recepção');--> statement-breakpoint

INSERT INTO "cargo" (tenant_id, nome, sistema, chao, permissoes, exige_2fa)
SELECT t.id, 'Produção', true, true,
  ARRAY['os:avancar'],
  false
FROM "tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "cargo" c WHERE c.tenant_id = t.id AND c.nome = 'Produção');--> statement-breakpoint

INSERT INTO "cargo" (tenant_id, nome, sistema, chao, permissoes, exige_2fa)
SELECT t.id, 'Financeiro', true, false,
  ARRAY['dinheiro:ver','orcamento:editar','os:editar'],
  true
FROM "tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "cargo" c WHERE c.tenant_id = t.id AND c.nome = 'Financeiro');--> statement-breakpoint

INSERT INTO "cargo" (tenant_id, nome, sistema, chao, permissoes, exige_2fa)
SELECT t.id, 'Peças/Compras', true, false,
  ARRAY['dinheiro:ver_peca','os:avancar'],
  false
FROM "tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "cargo" c WHERE c.tenant_id = t.id AND c.nome = 'Peças/Compras');--> statement-breakpoint

INSERT INTO "cargo" (tenant_id, nome, sistema, chao, permissoes, exige_2fa)
SELECT t.id, 'Pós-venda', true, false,
  ARRAY['os:avancar','cadastro:editar'],
  false
FROM "tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "cargo" c WHERE c.tenant_id = t.id AND c.nome = 'Pós-venda');--> statement-breakpoint

-- Liga cada usuário ao cargo-semente correspondente ao seu papel atual (só onde ainda não ligado).
UPDATE "usuario" u SET cargo_id = c.id
FROM "cargo" c
WHERE c.tenant_id = u.tenant_id
  AND u.cargo_id IS NULL
  AND ( (u.papel = 'dono' AND c.nome = 'Dono')
     OR (u.papel = 'gestor' AND c.nome = 'Gestor')
     OR (u.papel = 'recepcao' AND c.nome = 'Recepção')
     OR (u.papel = 'producao' AND c.nome = 'Produção') );
