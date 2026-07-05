import { cache } from "react";
import { exigeMfa, type Permissao } from "@/domain/auth/cargo";
import type { Papel } from "@/domain/auth/papel";
import { resolverPerfilPorAuthUserId } from "@/infra/auth/perfil-repo";
import { createSupabaseServer } from "@/infra/auth/supabase-server";
import { db } from "@/infra/db/client";

export interface SessaoUsuario {
  tenantId: string;
  usuarioId: string;
  papel: Papel;
  tenantNome: string;
  cargoNome: string;
  permissoes: Permissao[];
  exige2fa: boolean;
  /** cargo:gerir é implícito e exclusivo do Dono. */
  podeGerirCargos: boolean;
}

/**
 * Sessão corrente do servidor: usuário autenticado + perfil da app (tenant, cargo, permissões).
 * Retorna null se não há sessão ou perfil.
 *
 * MEMOIZADO POR REQUEST (`React.cache`): a página e a `AppShell` compartilham numa mesma renderização.
 *
 * AUTH LOCAL (perf da navegação): usa `getClaims()` (valida a assinatura do JWT — local, sem
 * round-trip de rede ao Supabase Auth) em vez de `getUser()` (que bate na rede a cada chamada). A
 * FRONTEIRA de segurança é o middleware (`atualizarSessaoEProteger`), que faz o `getUser()` de rede e
 * renova/expira a sessão a cada request; as pages confiam nessa validação (padrão @supabase/ssr).
 * `getClaims()` ainda rejeita um JWT adulterado/expirado — só não detecta revogação no mesmo instante
 * (o próximo request, via middleware, detecta). Corta 1 round-trip de rede por navegação.
 */
export const sessaoAtual = cache(async (): Promise<SessaoUsuario | null> => {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const authUserId = data?.claims?.sub;
  if (!authUserId) {
    return null;
  }
  const perfil = await resolverPerfilPorAuthUserId(db, authUserId);
  if (!perfil) {
    return null;
  }
  return {
    tenantId: perfil.tenantId,
    usuarioId: perfil.usuarioId,
    papel: perfil.papel,
    tenantNome: perfil.tenantNome,
    cargoNome: perfil.cargoNome,
    permissoes: perfil.permissoes,
    exige2fa: exigeMfa({ chao: false, exige2fa: perfil.exige2fa, permissoes: perfil.permissoes }),
    podeGerirCargos: perfil.cargoNome === "Dono",
  };
});
