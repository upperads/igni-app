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
    cargoNome: perfil.cargoNome,
    permissoes: perfil.permissoes,
    exige2fa: exigeMfa({ chao: false, exige2fa: perfil.exige2fa, permissoes: perfil.permissoes }),
    podeGerirCargos: perfil.cargoNome === "Dono",
  };
});
