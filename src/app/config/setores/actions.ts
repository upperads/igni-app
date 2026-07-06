"use server";

import { revalidatePath } from "next/cache";
import { type Permissao, pode } from "@/domain/auth/rbac";
import { DadosInvalidosError } from "@/domain/shared/errors";
import { type SessaoUsuario, sessaoAtual } from "@/infra/auth/sessao";
import {
  criarSetorNoTenant,
  moverEstacaoNoTenant,
  removerSetorNoTenant,
  renomearSetorNoTenant,
  reordenarSetoresNoTenant,
} from "@/infra/composition/setor";

/** Autorização no boundary: setores agrupam estações — só gestão (dono/gestor) configura. */
async function autorizar(acao: Permissao): Promise<{ sessao: SessaoUsuario } | { erro: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { erro: "Sua sessão expirou. Entre novamente." };
  }
  if (!pode(sessao.permissoes, acao)) {
    return { erro: "Você não tem permissão para configurar os setores." };
  }
  return { sessao };
}

export interface ResultadoAcao {
  ok: boolean;
  motivo?: string;
}

export async function acaoCriarSetor(nome: string): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await criarSetorNoTenant(auth.sessao, nome);
    revalidatePath("/config/setores");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível criar o setor." };
  }
}

export async function acaoRenomearSetor(id: string, nome: string): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await renomearSetorNoTenant(auth.sessao, id, nome);
    revalidatePath("/config/setores");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível renomear." };
  }
}

export async function acaoReordenarSetores(idsNaOrdem: string[]): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await reordenarSetoresNoTenant(auth.sessao, idsNaOrdem);
    revalidatePath("/config/setores");
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível reordenar." };
  }
}

export async function acaoRemoverSetor(id: string): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await removerSetorNoTenant(auth.sessao, id);
    revalidatePath("/config/setores");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível remover." };
  }
}

export async function acaoMoverEstacao(estacaoId: string, setorId: string): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await moverEstacaoNoTenant(auth.sessao, estacaoId, setorId);
    revalidatePath("/config/setores");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível mover a estação." };
  }
}
