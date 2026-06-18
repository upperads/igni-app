ALTER TABLE "usuario" ADD COLUMN "auth_user_id" uuid;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_auth_user_id_unique" UNIQUE("auth_user_id");