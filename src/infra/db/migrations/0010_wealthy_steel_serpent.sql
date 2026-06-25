CREATE TYPE "public"."status_orcamento" AS ENUM('rascunho', 'enviado', 'aprovado', 'recusado');--> statement-breakpoint
CREATE TYPE "public"."tipo_item_orcamento" AS ENUM('peca', 'mao_de_obra', 'terceiro');--> statement-breakpoint
CREATE TABLE "orcamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"os_id" uuid NOT NULL,
	"status" "status_orcamento" DEFAULT 'rascunho' NOT NULL,
	"token_hash" text,
	"token_expira_em" timestamp with time zone,
	"enviado_em" timestamp with time zone,
	"aprovado_em" timestamp with time zone,
	"recusado_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orcamento_os_unico" UNIQUE("os_id")
);
--> statement-breakpoint
CREATE TABLE "orcamento_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"orcamento_id" uuid NOT NULL,
	"tipo" "tipo_item_orcamento" NOT NULL,
	"descricao" text NOT NULL,
	"valor_centavos" integer NOT NULL,
	"markup_pct" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "cq_aprovado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_os_id_os_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."os"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_item" ADD CONSTRAINT "orcamento_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_item" ADD CONSTRAINT "orcamento_item_orcamento_id_orcamento_id_fk" FOREIGN KEY ("orcamento_id") REFERENCES "public"."orcamento"("id") ON DELETE cascade ON UPDATE no action;