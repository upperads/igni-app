import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Conexão administrativa do Postgres (migrations e rotinas internas controladas).
 *
 * ATENÇÃO (ADR-005): este cliente NÃO aplica RLS por si só. O acesso a dados por
 * tenant — que dropa privilégio para um papel não-privilegiado e faz
 * `SET LOCAL app.current_tenant` por transação — virá num helper dedicado na US-01.
 * Use este `db` apenas onde o escopo de tenant não se aplica (ex.: migrations).
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não definido — veja .env.example");
}

const queryClient = postgres(connectionString);

export const db = drizzle(queryClient, { schema });
