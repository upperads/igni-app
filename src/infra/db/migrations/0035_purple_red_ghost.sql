CREATE TYPE "public"."forma_pagamento" AS ENUM('dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'transferencia', 'boleto');--> statement-breakpoint
ALTER TABLE "conta_receber" ADD COLUMN "forma_pagamento" "forma_pagamento";--> statement-breakpoint
ALTER TABLE "conta_receber" ADD COLUMN "recebido_em" timestamp with time zone;