import { and, eq, gt } from "drizzle-orm";
import type { AppDatabase } from "@/infra/db/connection";
import { tentativaLogin } from "@/infra/db/schema";

/**
 * Acesso à tabela `tentativa_login` (lockout, RNF-SEC-05). Sempre pela conexão PRIVILEGIADA
 * (`db`): a tabela é deny-all por RLS e o login acontece antes de existir um tenant.
 */

export async function registrarFalhaLogin(
  db: AppDatabase,
  email: string,
  ocorridoEm: Date,
): Promise<void> {
  await db.insert(tentativaLogin).values({ email, ocorridoEm });
}

export async function limparTentativasLogin(db: AppDatabase, email: string): Promise<void> {
  await db.delete(tentativaLogin).where(eq(tentativaLogin.email, email));
}

/** Datas das falhas do e-mail ocorridas DEPOIS de `desde` (início da janela de lockout). */
export async function falhasLoginDesde(
  db: AppDatabase,
  email: string,
  desde: Date,
): Promise<Date[]> {
  const rows = await db
    .select({ em: tentativaLogin.ocorridoEm })
    .from(tentativaLogin)
    .where(and(eq(tentativaLogin.email, email), gt(tentativaLogin.ocorridoEm, desde)));
  return rows.map((r) => r.em);
}
