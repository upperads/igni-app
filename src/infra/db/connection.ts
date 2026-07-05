import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { TenantContextoInvalidoError } from "@/domain/shared/errors";
import * as schema from "./schema";

/** UUID de qualquer versão. O `tenantId` precisa casar antes de virar contexto de RLS. */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AppDatabase = PostgresJsDatabase<typeof schema>;
/** A transação que o `withTenant` entrega ao callback (já escopada por tenant). */
export type TenantTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export interface Database {
  /** Conexão privilegiada (bypass RLS). Use só onde não há escopo de tenant (migrations, onboarding). */
  readonly db: AppDatabase;
  readonly sql: postgres.Sql;
  /** Executa `fn` numa transação escopada ao tenant, com a RLS ativa (ADR-005). */
  withTenant<T>(tenantId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function createDatabase(connectionString: string): Database {
  // Tuning do pool (perf da navegação): a produção usa o SESSION pooler do Supabase (porta 5432), onde
  // prepared statements funcionam — então NÃO desligamos `prepare` (desligar degradaria). `idle_timeout`
  // devolve conexões ociosas (evita segurar slots do pooler); `connect_timeout` falha rápido em vez de
  // pendurar o request. `max` limita o pool desta instância. Se um dia migrar para o TRANSACTION pooler
  // (porta 6543), aí sim é obrigatório `prepare: false`.
  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  const db = drizzle(client, { schema });

  async function withTenant<T>(
    tenantId: string,
    fn: (tx: TenantTx) => Promise<T>,
  ): Promise<T> {
    // Fail-closed explícito: um tenantId não-UUID erraria no cast `::uuid` da política (500).
    // Validar aqui devolve erro claro e mantém o request íntegro (achado ALTA do review US-01).
    if (!UUID_REGEX.test(tenantId)) {
      throw new TenantContextoInvalidoError(tenantId);
    }
    return db.transaction(async (tx) => {
      // ADR-005: fixa o tenant da transação (ainda como papel privilegiado)...
      await tx.execute(sql`select set_config('app.current_tenant', ${tenantId}, true)`);
      // ...e então dropa para o papel sujeito à RLS. Ambos LOCAL: revertem no commit/rollback,
      // então a conexão volta limpa ao pool.
      await tx.execute(sql`set local role app_user`);
      // INVARIANTE (achado MÉDIO do review US-01): NUNCA execute SQL raw/concatenado com
      // entrada do usuário dentro de `fn` — o GUC `app.current_tenant` é re-gravável; aqui só
      // entra Drizzle parametrizado. Assim o valor do atacante nunca vira um novo `set_config`.
      return fn(tx);
    });
  }

  return {
    db,
    sql: client,
    withTenant,
    close: () => client.end(),
  };
}
