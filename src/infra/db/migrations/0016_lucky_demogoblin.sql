ALTER TYPE "public"."modalidade_entrada" ADD VALUE 'patio_oficina';--> statement-breakpoint
ALTER TYPE "public"."modalidade_entrada" ADD VALUE 'outra';--> statement-breakpoint
ALTER TABLE "entrada" ADD COLUMN "modalidade_descricao" text;