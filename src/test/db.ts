import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { createDatabase, type Database } from "@/infra/db/connection";
import * as schema from "@/infra/db/schema";

/** URL do banco de TESTES (igni_test). Nunca aponte para o banco de dev/prod. */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL não definido — veja .env.example");
  }
  return url;
}

/**
 * Zera o schema e reaplica TODAS as migrations no banco de testes. Roda como conexão
 * privilegiada. O papel `app_user` (cluster-global) sobrevive ao reset — por isso a
 * migration de RLS cria o papel de forma idempotente.
 */
export async function resetAndMigrate(): Promise<void> {
  // `onnotice` silenciado: o `drop schema ... cascade` emite NOTICEs ruidosos e esperados.
  const admin = postgres(testDatabaseUrl(), { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(
      "drop schema if exists public cascade; create schema public; drop schema if exists drizzle cascade;",
    );
    const adminDb = drizzle(admin, { schema });
    await migrate(adminDb, { migrationsFolder: "src/infra/db/migrations" });
  } finally {
    await admin.end();
  }
}

export function createTestDatabase(): Database {
  return createDatabase(testDatabaseUrl());
}
