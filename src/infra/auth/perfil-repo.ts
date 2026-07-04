import { and, eq, isNull } from "drizzle-orm";
import type { Permissao } from "@/domain/auth/cargo";
import type { Papel } from "@/domain/auth/papel";
import type { AppDatabase } from "@/infra/db/connection";
import { cargo, tenant, usuario } from "@/infra/db/schema";

export interface PerfilUsuario {
  usuarioId: string;
  tenantId: string;
  papel: Papel;
  tenantNome: string;
  cargoNome: string;
  permissoes: Permissao[];
  exige2fa: boolean;
}

/**
 * Resolve o perfil da app a partir da identidade autenticada. Agora traz o CARGO (nome, permissões,
 * flag 2FA) — fonte de verdade do RBAC (P-1). `papel` permanece (legado). Membro desativado não
 * resolve (I1). leftJoin no cargo: usuário sem cargo (transitório) resolve com permissões vazias.
 */
export async function resolverPerfilPorAuthUserId(
  db: AppDatabase,
  authUserId: string,
): Promise<PerfilUsuario | null> {
  const [row] = await db
    .select({
      usuarioId: usuario.id,
      tenantId: usuario.tenantId,
      papel: usuario.papel,
      tenantNome: tenant.nome,
      cargoNome: cargo.nome,
      permissoes: cargo.permissoes,
      exige2faFlag: cargo.exige2fa,
    })
    .from(usuario)
    .innerJoin(tenant, eq(tenant.id, usuario.tenantId))
    .leftJoin(cargo, eq(cargo.id, usuario.cargoId))
    .where(and(eq(usuario.authUserId, authUserId), isNull(usuario.desativadoEm)))
    .limit(1);

  if (!row) {
    return null;
  }
  return {
    usuarioId: row.usuarioId,
    tenantId: row.tenantId,
    papel: row.papel,
    tenantNome: row.tenantNome,
    cargoNome: row.cargoNome ?? "",
    permissoes: (row.permissoes ?? []) as Permissao[],
    exige2fa: row.exige2faFlag ?? false,
  };
}
