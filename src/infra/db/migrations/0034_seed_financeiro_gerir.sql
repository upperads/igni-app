-- P-4a: adiciona a permissão 'financeiro:gerir' aos cargos-sistema Dono/Gestor/Financeiro de TODOS
-- os tenants (que já existem do seed do P-1). Idempotente via NOT (... = ANY(permissoes)).
UPDATE "cargo"
SET permissoes = array_append(permissoes, 'financeiro:gerir')
WHERE sistema = true
  AND nome IN ('Dono', 'Gestor', 'Financeiro')
  AND NOT ('financeiro:gerir' = ANY(permissoes));
