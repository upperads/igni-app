import { and, eq, isNull } from "drizzle-orm";
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
 *
 * Membro DESATIVADO (saiu da firma) não resolve perfil → a sessão não se estabelece → sem acesso.
 * É aqui que a desativação da equipe (I1) vira enforcement real, não só um rótulo na tela.
 */
export async function resolverPerfilPorAuthUserId(
  db: AppDatabase,
  authUserId: string,
): Promise<PerfilUsuario | null> {
  const [row] = await db
    .select({ usuarioId: usuario.id, tenantId: usuario.tenantId, papel: usuario.papel })
    .from(usuario)
    .where(and(eq(usuario.authUserId, authUserId), isNull(usuario.desativadoEm)))
    .limit(1);

  return row ?? null;
}
