"use server";

import { revalidatePath } from "next/cache";
import { type Acao, pode } from "@/domain/auth/rbac";
import { type SessaoUsuario, sessaoAtual } from "@/infra/auth/sessao";
import {
  limparDemonstracaoNoTenant,
  semearDemonstracaoNoTenant,
} from "@/infra/composition/config";

/** Preencher/limpar a demonstração é configuração da oficina: só dono/gestor. */
async function autorizar(acao: Acao): Promise<{ sessao: SessaoUsuario } | { erro: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { erro: "Sua sessão expirou. Entre novamente." };
  }
  if (!pode(sessao.papel, acao)) {
    return { erro: "Você não tem permissão para isso." };
  }
  return { sessao };
}

/** Revalida as telas que mostram OS, para a demo aparecer/sumir na hora. */
function revalidarTudo(): void {
  revalidatePath("/");
  revalidatePath("/os");
  revalidatePath("/triagem");
  revalidatePath("/chao");
  revalidatePath("/relatorio");
}

export interface ResultadoAcao {
  ok: boolean;
  motivo?: string;
}

export async function acaoPreencherDemonstracao(): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await semearDemonstracaoNoTenant(auth.sessao);
    revalidarTudo();
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível preencher a demonstração. Tente novamente." };
  }
}

export async function acaoLimparDemonstracao(): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await limparDemonstracaoNoTenant(auth.sessao);
    revalidarTudo();
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível limpar a demonstração. Tente novamente." };
  }
}
