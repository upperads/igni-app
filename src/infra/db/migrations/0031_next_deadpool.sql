ALTER TYPE "public"."modo_tela" ADD VALUE 'setor';--> statement-breakpoint
ALTER TABLE "tela" ADD COLUMN "setor_id" uuid;--> statement-breakpoint
ALTER TABLE "tela" ADD CONSTRAINT "tela_setor_id_setor_id_fk" FOREIGN KEY ("setor_id") REFERENCES "public"."setor"("id") ON DELETE set null ON UPDATE no action;