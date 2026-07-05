CREATE TYPE "public"."modo_tela" AS ENUM('estacao', 'geral');--> statement-breakpoint
CREATE TABLE "tela" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"modo" "modo_tela" NOT NULL,
	"estacao_id" uuid,
	"token_hash" text NOT NULL,
	"codigo_curto" text NOT NULL,
	"criado_por" uuid,
	"revogado_em" timestamp with time zone,
	"ultimo_uso_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tela_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "tela_codigo_curto_unique" UNIQUE("codigo_curto")
);
--> statement-breakpoint
ALTER TABLE "tela" ADD CONSTRAINT "tela_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tela" ADD CONSTRAINT "tela_estacao_id_estacao_id_fk" FOREIGN KEY ("estacao_id") REFERENCES "public"."estacao"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tela" ADD CONSTRAINT "tela_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;