CREATE TABLE "tentativa_login" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"ocorrido_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tentativa_login_email_ocorrido_idx" ON "tentativa_login" USING btree ("email","ocorrido_em");