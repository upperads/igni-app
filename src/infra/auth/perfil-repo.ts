import { eq } from "drizzle-orm";
import type { Papel } from "@/domain/auth/papel";
import type { AppDatabase } from "@/infra/db/connection";
import { usuario } from "@/infra/db/schema";

export interface PerfilUsuario {
  usuarioId: string;
  tenantId: string;
  papel: Papel;
}

/**
 * Resolve o perfil da app (tenant + papel) a partir da identidade autenticada. Leitura de
 * bootstrap da sessão: roda na conexão privilegiada porque ainda não há `tenant` corrente.
 */
export async function resolverPerfilPorAuthUserId(
  db: AppDatabase,
  authUserId: string,
): Promise<PerfilUsuario | null> {
  const [row] = await db
    .select({ usuarioId: usuario.id, tenantId: usuario.tenantId, papel: usuario.papel })
    .from(usuario)
    .where(eq(usuario.authUserId, authUserId))
    .limit(1);

  return row ?? null;
}
