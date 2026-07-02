import { cache } from "react";
import type { Papel } from "@/domain/auth/papel";
import { resolverPerfilPorAuthUserId } from "@/infra/auth/perfil-repo";
import { createSupabaseServer } from "@/infra/auth/supabase-server";
import { db } from "@/infra/db/client";

export interface SessaoUsuario {
  tenantId: string;
  usuarioId: string;
  papel: Papel;
  /** Nome da oficina (para o cabeçalho). */
  tenantNome: string;
}

/**
 * Sessão corrente do servidor: usuário autenticado (Supabase) + perfil da app (tenant, papel).
 * Retorna null se não há sessão ou perfil. Leitura de bootstrap (conexão privilegiada).
 *
 * MEMOIZADO POR REQUEST (`React.cache`): numa mesma renderização, a página E a `AppShell` (e qualquer
 * outro componente) chamam isto sem refazer `getUser()` (round-trip ao Supabase) + a query de perfil.
 * Antes, cada navegação pagava essa latência 2× — esta dedupe é a correção da navegação lenta.
 */
export const sessaoAtual = cache(async (): Promise<SessaoUsuario | null> => {
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
  return {
    tenantId: perfil.tenantId,
    usuarioId: perfil.usuarioId,
    papel: perfil.papel,
    tenantNome: perfil.tenantNome,
  };
});
