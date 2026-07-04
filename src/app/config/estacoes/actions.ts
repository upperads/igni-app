"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { type Permissao, pode } from "@/domain/auth/cargo";
import { DadosInvalidosError } from "@/domain/shared/errors";
import { type SessaoUsuario, sessaoAtual } from "@/infra/auth/sessao";
import {
  adicionarEstacaoNoTenant,
  removerEstacaoNoTenant,
  renomearEstacaoNoTenant,
  reordenarEstacoesNoTenant,
} from "@/infra/composition/config";
import {
  gerarQuiosqueNoTenant,
  revogarQuiosqueNoTenant,
} from "@/infra/composition/quiosque";

/** Autorização no boundary: estações são configuração — só gestão (dono/gestor) ajusta. */
async function autorizar(acao: Permissao): Promise<{ sessao: SessaoUsuario } | { erro: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { erro: "Sua sessão expirou. Entre novamente." };
  }
  if (!pode(sessao.permissoes, acao)) {
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

export interface ResultadoQuiosque {
  ok: boolean;
  motivo?: string;
  qrDataUrl?: string;
  codigoCurto?: string;
  url?: string;
}

/** Liga o quiosque de um setor: gera token forte + código curto, e devolve o QR pronto (dataURL). */
export async function acaoGerarQuiosque(estacaoId: string): Promise<ResultadoQuiosque> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    const { token, codigoCurto } = await gerarQuiosqueNoTenant(auth.sessao, estacaoId);
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://igni-app-production.up.railway.app";
    const url = `${base}/quiosque/${token}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1 });
    revalidatePath("/config/estacoes");
    return { ok: true, qrDataUrl, codigoCurto, url };
  } catch {
    return { ok: false, motivo: "Não foi possível gerar o quiosque. Tente novamente." };
  }
}

export async function acaoRevogarQuiosque(quiosqueId: string): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await revogarQuiosqueNoTenant(auth.sessao, quiosqueId);
    revalidatePath("/config/estacoes");
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível revogar. Tente novamente." };
  }
}
