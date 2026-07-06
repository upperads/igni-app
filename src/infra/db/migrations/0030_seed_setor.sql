-- Migração sem quebrar (P-5a): cada estação existente vira seu próprio setor (nome/ordem iguais),
-- e a estação é ligada a esse setor. O dono reagrupa depois na tela. Ao fim, NENHUMA estação fica
-- com setor_id nulo. Idempotência via WHERE setor_id IS NULL.

INSERT INTO "setor" (tenant_id, nome, ordem)
SELECT e.tenant_id, e.nome, e.ordem
FROM "estacao" e
WHERE e.setor_id IS NULL;--> statement-breakpoint

UPDATE "estacao" e SET setor_id = s.id
FROM "setor" s
WHERE e.setor_id IS NULL
  AND s.tenant_id = e.tenant_id
  AND s.nome = e.nome
  AND s.ordem = e.ordem;
