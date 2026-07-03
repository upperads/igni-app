CREATE TABLE "quiosque_setor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"estacao_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"codigo_curto" text NOT NULL,
	"criado_por" uuid,
	"revogado_em" timestamp with time zone,
	"ultimo_uso_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiosque_setor_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "quiosque_setor_codigo_curto_unique" UNIQUE("codigo_curto")
);
--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "pin_hash" text;--> statement-breakpoint
ALTER TABLE "quiosque_setor" ADD CONSTRAINT "quiosque_setor_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiosque_setor" ADD CONSTRAINT "quiosque_setor_estacao_id_estacao_id_fk" FOREIGN KEY ("estacao_id") REFERENCES "public"."estacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiosque_setor" ADD CONSTRAINT "quiosque_setor_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;