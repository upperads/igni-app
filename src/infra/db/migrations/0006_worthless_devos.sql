CREATE TYPE "public"."estado_os" AS ENUM('aberta', 'diagnostico', 'orcamento', 'aguardando_aprovacao', 'aguardando_peca', 'execucao', 'controle_qualidade', 'pronta', 'entregue');--> statement-breakpoint
CREATE TYPE "public"."modalidade_entrada" AS ENUM('so_usinagem', 'empresa_retira', 'ja_desmontado');--> statement-breakpoint
CREATE TYPE "public"."tipo_cliente" AS ENUM('frota', 'produtor', 'avulso');--> statement-breakpoint
CREATE TABLE "cliente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"contato_whatsapp" text,
	"tipo" "tipo_cliente" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"placa" text,
	"chassi" text,
	"modelo_motor" text,
	"maquina_unica" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entrada" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"modalidade" "modalidade_entrada" NOT NULL,
	"pecas_recebidas" jsonb,
	"fotos" jsonb,
	"data_entrada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "os" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entrada_id" uuid NOT NULL,
	"equipamento_id" uuid NOT NULL,
	"estacao_id" uuid,
	"responsavel_id" uuid,
	"tipo_servico" text,
	"estado" "estado_os" DEFAULT 'aberta' NOT NULL,
	"prazo_prometido" date,
	"entrou_no_estado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"os_id" uuid NOT NULL,
	"de_estado" "estado_os",
	"para_estado" "estado_os" NOT NULL,
	"por_usuario_id" uuid,
	"motivo" text,
	"em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipamento" ADD CONSTRAINT "equipamento_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipamento" ADD CONSTRAINT "equipamento_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada" ADD CONSTRAINT "entrada_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada" ADD CONSTRAINT "entrada_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_entrada_id_entrada_id_fk" FOREIGN KEY ("entrada_id") REFERENCES "public"."entrada"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_equipamento_id_equipamento_id_fk" FOREIGN KEY ("equipamento_id") REFERENCES "public"."equipamento"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_estacao_id_estacao_id_fk" FOREIGN KEY ("estacao_id") REFERENCES "public"."estacao"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_responsavel_id_usuario_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento" ADD CONSTRAINT "evento_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento" ADD CONSTRAINT "evento_os_id_os_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."os"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento" ADD CONSTRAINT "evento_por_usuario_id_usuario_id_fk" FOREIGN KEY ("por_usuario_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;