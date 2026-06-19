import type { Papel } from "@/domain/auth/papel";
import { resolverPerfilPorAuthUserId } from "@/infra/auth/perfil-repo";
import { createSupabaseServer } from "@/infra/auth/supabase-server";
import { db } from "@/infra/db/client";

export interface SessaoUsuario {
  tenantId: string;
  usuarioId: string;
  papel: Papel;
}

/**
 * Sessão corrente do servidor: usuário autenticado (Supabase) + perfil da app (tenant, papel).
 * Retorna null se não há sessão ou perfil. Leitura de bootstrap (conexão privilegiada).
 */
export async function sessaoAtual(): Promise<SessaoUsuario | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }
  const perfil = await resolverPerfilPorAuthUserId(db, user.id);
  if (!perfil) {
    return null;
  }
  return { tenantId: perfil.tenantId, usuarioId: perfil.usuarioId, papel: perfil.papel };
}
