-- ADR-011: número sequencial de OS por tenant. Tabela-contador + coluna `os.numero`.
-- BACKFILL SEGURO (há dados em prod): adiciona nulável → numera o existente por tenant/created_at →
-- semeia o contador → SET NOT NULL → UNIQUE. O snapshot reflete o estado final (drift-check ok).

CREATE TABLE "tenant_contador_os" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"proximo" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_contador_os" ADD CONSTRAINT "tenant_contador_os_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- 1) coluna nulável (não quebra linhas existentes)
ALTER TABLE "os" ADD COLUMN "numero" integer;--> statement-breakpoint

-- 2) numera as OS existentes: 1, 2, 3… por tenant, na ordem de criação
WITH numerada AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS n
  FROM "os"
)
UPDATE "os" SET "numero" = numerada.n FROM numerada WHERE "os".id = numerada.id;--> statement-breakpoint

-- 3) semeia o contador com o próximo número de cada tenant
INSERT INTO "tenant_contador_os" ("tenant_id", "proximo")
  SELECT tenant_id, COUNT(*) + 1 FROM "os" GROUP BY tenant_id
  ON CONFLICT ("tenant_id") DO NOTHING;--> statement-breakpoint

-- 4) agora que tudo tem número, torna obrigatório e único por tenant
ALTER TABLE "os" ALTER COLUMN "numero" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_numero_tenant" UNIQUE("tenant_id","numero");
