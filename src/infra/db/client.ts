import { createDatabase } from "./connection";

/**
 * Instância única do banco para uso da aplicação (lê `DATABASE_URL`).
 *
 * - `db`        → conexão privilegiada: migrations e onboarding (criar oficina), onde ainda
 *                 não há um tenant corrente. NÃO aplica RLS (ADR-005).
 * - `withTenant`→ acesso a dados escopado ao tenant, com RLS ativa. É o caminho normal das
 *                 rotas/casos de uso após a autenticação.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não definido — veja .env.example");
}

export const database = createDatabase(connectionString);
export const db = database.db;
export const withTenant = database.withTenant;
