"use server";

import { revalidatePath } from "next/cache";
import { type Permissao, pode } from "@/domain/auth/cargo";
import { pinValido } from "@/domain/os/pin";
import { DadosInvalidosError, EmailJaCadastradoError } from "@/domain/shared/errors";
import { type SessaoUsuario, sessaoAtual } from "@/infra/auth/sessao";
import {
  convidarMembroNoTenant,
  desativarMembroNoTenant,
  mudarCargoNoTenant,
  reativarMembroNoTenant,
} from "@/infra/composition/equipe";
import { definirPinNoTenant, limparPinNoTenant } from "@/infra/composition/quiosque";

/** Autorização no boundary: gerir equipe é coisa de administração (cargo com equipe:gerir). */
async function autorizar(acao: Permissao): Promise<{ sessao: SessaoUsuario } | { erro: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { erro: "Sua sessão expirou. Entre novamente." };
  }
  if (!pode(sessao.permissoes, acao)) {
    return { erro: "Você não tem permissão para gerenciar a equipe." };
  }
  return { sessao };
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
  cargoId: string,
): Promise<ResultadoConvite> {
  const auth = await autorizar("equipe:gerir");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  if (!cargoId.trim()) {
    return { ok: false, motivo: "Selecione um cargo válido." };
  }
  try {
    const r = await convidarMembroNoTenant(auth.sessao, {
      nome,
      email,
      cargoId,
      podeGerirCargos: auth.sessao.podeGerirCargos,
    });
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

export async function acaoMudarCargo(membroId: string, cargoId: string): Promise<ResultadoAcao> {
  const auth = await autorizar("equipe:gerir");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  if (!cargoId.trim()) {
    return { ok: false, motivo: "Selecione um cargo válido." };
  }
  try {
    await mudarCargoNoTenant(auth.sessao, membroId, cargoId, auth.sessao.podeGerirCargos);
    revalidatePath("/config/equipe");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível mudar o cargo. Tente novamente." };
  }
}

export async function acaoDesativarMembro(membroId: string): Promise<ResultadoAcao> {
  const auth = await autorizar("equipe:gerir");
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
  const auth = await autorizar("equipe:gerir");
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

/** Define (ou troca) o PIN de 4 dígitos de um membro de produção — carimbo de autoria no quiosque. */
export async function acaoDefinirPin(membroId: string, pin: string): Promise<ResultadoAcao> {
  const auth = await autorizar("equipe:gerir");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  if (!pinValido(pin)) {
    return { ok: false, motivo: "O PIN precisa ter exatamente 4 dígitos." };
  }
  try {
    await definirPinNoTenant(auth.sessao, membroId, pin);
    revalidatePath("/config/equipe");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível definir o PIN. Tente novamente." };
  }
}

export async function acaoLimparPin(membroId: string): Promise<ResultadoAcao> {
  const auth = await autorizar("equipe:gerir");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await limparPinNoTenant(auth.sessao, membroId);
    revalidatePath("/config/equipe");
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível limpar o PIN. Tente novamente." };
  }
}
