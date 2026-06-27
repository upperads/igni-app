"use server";

import { revalidatePath } from "next/cache";
import { type Acao, pode } from "@/domain/auth/rbac";
import { PAPEIS, type Papel } from "@/domain/auth/papel";
import { DadosInvalidosError, EmailJaCadastradoError } from "@/domain/shared/errors";
import { type SessaoUsuario, sessaoAtual } from "@/infra/auth/sessao";
import {
  convidarMembroNoTenant,
  desativarMembroNoTenant,
  mudarPapelNoTenant,
  reativarMembroNoTenant,
} from "@/infra/composition/equipe";

/** Autorização no boundary: gerir equipe é coisa de administração (dono/gestor). */
async function autorizar(acao: Acao): Promise<{ sessao: SessaoUsuario } | { erro: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { erro: "Sua sessão expirou. Entre novamente." };
  }
  if (!pode(sessao.papel, acao)) {
    return { erro: "Você não tem permissão para gerenciar a equipe." };
  }
  return { sessao };
}

function papelValido(valor: string): valor is Papel {
  return (PAPEIS as readonly string[]).includes(valor);
}

export interface ResultadoConvite {
  ok: boolean;
  motivo?: string;
  /** Mostrado uma vez ao dono para ele entregar ao membro. */
  senhaProvisoria?: string;
  email?: string;
}

/** Convida um membro: cria a identidade com senha provisória e devolve a senha para entregar. */
export async function acaoConvidarMembro(
  nome: string,
  email: string,
  papel: string,
): Promise<ResultadoConvite> {
  const auth = await autorizar("usuario:gerenciar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  if (!papelValido(papel)) {
    return { ok: false, motivo: "Selecione um papel válido." };
  }
  try {
    const r = await convidarMembroNoTenant(auth.sessao, { nome, email, papel });
    revalidatePath("/config/equipe");
    return { ok: true, senhaProvisoria: r.senhaProvisoria, email: email.trim().toLowerCase() };
  } catch (erro) {
    if (erro instanceof EmailJaCadastradoError) {
      return { ok: false, motivo: "Esse e-mail já tem conta no Igni." };
    }
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível convidar. Tente novamente." };
  }
}

export interface ResultadoAcao {
  ok: boolean;
  motivo?: string;
}

export async function acaoMudarPapel(membroId: string, papel: string): Promise<ResultadoAcao> {
  const auth = await autorizar("usuario:gerenciar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  if (!papelValido(papel)) {
    return { ok: false, motivo: "Selecione um papel válido." };
  }
  try {
    await mudarPapelNoTenant(auth.sessao, membroId, papel);
    revalidatePath("/config/equipe");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível mudar o papel. Tente novamente." };
  }
}

export async function acaoDesativarMembro(membroId: string): Promise<ResultadoAcao> {
  const auth = await autorizar("usuario:gerenciar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await desativarMembroNoTenant(auth.sessao, membroId);
    revalidatePath("/config/equipe");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível desativar. Tente novamente." };
  }
}

export async function acaoReativarMembro(membroId: string): Promise<ResultadoAcao> {
  const auth = await autorizar("usuario:gerenciar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await reativarMembroNoTenant(auth.sessao, membroId);
    revalidatePath("/config/equipe");
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível reativar. Tente novamente." };
  }
}
