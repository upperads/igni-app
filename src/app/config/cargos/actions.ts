"use server";

import { revalidatePath } from "next/cache";
import { type Permissao } from "@/domain/auth/cargo";
import { DadosInvalidosError } from "@/domain/shared/errors";
import { type SessaoUsuario, sessaoAtual } from "@/infra/auth/sessao";
import {
  criarCargoNoTenant,
  editarCargoNoTenant,
  excluirCargoNoTenant,
  renomearCargoNoTenant,
} from "@/infra/composition/cargo";

/** Gerir cargos é exclusivo do Dono (cargo:gerir implícito, fora do catálogo atribuível). */
async function autorizar(): Promise<{ sessao: SessaoUsuario } | { erro: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { erro: "Sua sessão expirou. Entre novamente." };
  }
  if (!sessao.podeGerirCargos) {
    return { erro: "Só o Dono gerencia cargos." };
  }
  return { sessao };
}

export interface ResultadoAcao {
  ok: boolean;
  motivo?: string;
}

export async function acaoCriarCargo(
  nome: string,
  chao: boolean,
  exige2fa: boolean,
  permissoes: string[],
): Promise<ResultadoAcao> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await criarCargoNoTenant(auth.sessao, { nome, chao, exige2fa, permissoes: permissoes as Permissao[] });
    revalidatePath("/config/cargos");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível criar o cargo." };
  }
}

export async function acaoEditarCargo(
  id: string,
  nome: string,
  chao: boolean,
  exige2fa: boolean,
  permissoes: string[],
): Promise<ResultadoAcao> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await editarCargoNoTenant(auth.sessao, id, { nome, chao, exige2fa, permissoes: permissoes as Permissao[] });
    revalidatePath("/config/cargos");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível salvar o cargo." };
  }
}

export async function acaoRenomearCargo(id: string, nome: string): Promise<ResultadoAcao> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await renomearCargoNoTenant(auth.sessao, id, nome);
    revalidatePath("/config/cargos");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível renomear." };
  }
}

export async function acaoExcluirCargo(id: string): Promise<ResultadoAcao> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await excluirCargoNoTenant(auth.sessao, id);
    revalidatePath("/config/cargos");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível excluir." };
  }
}
