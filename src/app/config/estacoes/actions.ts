"use server";

import { revalidatePath } from "next/cache";
import { type Acao, pode } from "@/domain/auth/rbac";
import { DadosInvalidosError } from "@/domain/shared/errors";
import { type SessaoUsuario, sessaoAtual } from "@/infra/auth/sessao";
import {
  adicionarEstacaoNoTenant,
  removerEstacaoNoTenant,
  renomearEstacaoNoTenant,
  reordenarEstacoesNoTenant,
} from "@/infra/composition/config";

/** Autorização no boundary: estações são configuração — só gestão (dono/gestor) ajusta. */
async function autorizar(acao: Acao): Promise<{ sessao: SessaoUsuario } | { erro: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { erro: "Sua sessão expirou. Entre novamente." };
  }
  if (!pode(sessao.papel, acao)) {
    return { erro: "Você não tem permissão para configurar as estações." };
  }
  return { sessao };
}

export interface ResultadoAcao {
  ok: boolean;
  motivo?: string;
}

export async function acaoAdicionarEstacao(nome: string): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await adicionarEstacaoNoTenant(auth.sessao, nome);
    revalidatePath("/config/estacoes");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível adicionar a estação. Tente novamente." };
  }
}

export async function acaoRenomearEstacao(
  estacaoId: string,
  nome: string,
): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await renomearEstacaoNoTenant(auth.sessao, estacaoId, nome);
    revalidatePath("/config/estacoes");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível renomear a estação. Tente novamente." };
  }
}

export async function acaoReordenarEstacoes(idsNaOrdem: string[]): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await reordenarEstacoesNoTenant(auth.sessao, idsNaOrdem);
    revalidatePath("/config/estacoes");
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível reordenar. Tente novamente." };
  }
}

export async function acaoRemoverEstacao(estacaoId: string): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await removerEstacaoNoTenant(auth.sessao, estacaoId);
    revalidatePath("/config/estacoes");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível remover a estação. Tente novamente." };
  }
}
