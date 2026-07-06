CREATE TABLE "setor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"ordem" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "estacao" ADD COLUMN "setor_id" uuid;--> statement-breakpoint
ALTER TABLE "setor" ADD CONSTRAINT "setor_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estacao" ADD CONSTRAINT "estacao_setor_id_setor_id_fk" FOREIGN KEY ("setor_id") REFERENCES "public"."setor"("id") ON DELETE set null ON UPDATE no action;