CREATE TYPE "public"."prioridade_os" AS ENUM('critica', 'alta', 'normal', 'baixa');--> statement-breakpoint
CREATE TYPE "public"."responsabilidade" AS ENUM('empresa', 'cliente');--> statement-breakpoint
CREATE TABLE "ajuste_prioridade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"os_id" uuid NOT NULL,
	"de_prioridade" "prioridade_os",
	"para_prioridade" "prioridade_os" NOT NULL,
	"motivo" text,
	"por_usuario_id" uuid,
	"em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "prioridade" "prioridade_os" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "prioridade_score" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "prioridade_override" "prioridade_os";--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "travado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "travamento_motivo" text;--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "travamento_responsabilidade" "responsabilidade";--> statement-breakpoint
ALTER TABLE "ajuste_prioridade" ADD CONSTRAINT "ajuste_prioridade_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajuste_prioridade" ADD CONSTRAINT "ajuste_prioridade_os_id_os_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."os"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajuste_prioridade" ADD CONSTRAINT "ajuste_prioridade_por_usuario_id_usuario_id_fk" FOREIGN KEY ("por_usuario_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;