CREATE TYPE "public"."status_conta" AS ENUM('aberta', 'recebida', 'cancelada');--> statement-breakpoint
CREATE TABLE "conta_receber" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"os_id" uuid NOT NULL,
	"orcamento_id" uuid NOT NULL,
	"valor_centavos" integer NOT NULL,
	"status" "status_conta" DEFAULT 'aberta' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conta_receber_orcamento_unico" UNIQUE("orcamento_id")
);
--> statement-breakpoint
ALTER TABLE "conta_receber" ADD CONSTRAINT "conta_receber_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conta_receber" ADD CONSTRAINT "conta_receber_os_id_os_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."os"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conta_receber" ADD CONSTRAINT "conta_receber_orcamento_id_orcamento_id_fk" FOREIGN KEY ("orcamento_id") REFERENCES "public"."orcamento"("id") ON DELETE cascade ON UPDATE no action;