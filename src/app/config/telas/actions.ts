"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { type Permissao, pode } from "@/domain/auth/rbac";
import { type ModoTela } from "@/domain/os/tela";
import { DadosInvalidosError } from "@/domain/shared/errors";
import { type SessaoUsuario, sessaoAtual } from "@/infra/auth/sessao";
import {
  configurarTelaNoTenant,
  registrarTelaNoTenant,
  revogarTelaNoTenant,
} from "@/infra/composition/tela";

/** Autorização no boundary: trocar o que a TV mostra é configuração — só gestão (dono/gestor) mexe. */
async function autorizar(acao: Permissao): Promise<{ sessao: SessaoUsuario } | { erro: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { erro: "Sua sessão expirou. Entre novamente." };
  }
  if (!pode(sessao.permissoes, acao)) {
    return { erro: "Você não tem permissão para configurar as telas." };
  }
  return { sessao };
}

export interface ResultadoAcao {
  ok: boolean;
  motivo?: string;
}

export interface ResultadoRegistrar extends ResultadoAcao {
  qrDataUrl?: string;
  codigoCurto?: string;
  url?: string;
}

function lerModo(
  modo: string,
  estacaoId: string | null,
): { modo: ModoTela; estacaoId: string | null } | { erro: string } {
  if (modo !== "estacao" && modo !== "geral") {
    return { erro: "Modo inválido." };
  }
  return { modo, estacaoId: modo === "estacao" ? estacaoId : null };
}

/** Registra uma TV nova: gera token forte + código curto, e devolve o QR pronto (dataURL). */
export async function acaoRegistrarTela(
  nome: string,
  modo: string,
  estacaoId: string | null,
): Promise<ResultadoRegistrar> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  const m = lerModo(modo, estacaoId);
  if ("erro" in m) {
    return { ok: false, motivo: m.erro };
  }
  try {
    const { token, codigoCurto } = await registrarTelaNoTenant(auth.sessao, {
      nome,
      modo: m.modo,
      estacaoId: m.estacaoId,
    });
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://igni-app-production.up.railway.app";
    const url = `${base}/tv/${token}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1 });
    revalidatePath("/config/telas");
    return { ok: true, qrDataUrl, codigoCurto, url };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível registrar a tela. Tente novamente." };
  }
}

/**
 * O coração do P-3: troca remotamente o que a TV mostra. `configurarTelaNoTenant` chama
 * `notificarPainel` — a TV recebe o ping do Realtime e recarrega sozinha, sem ninguém ir até ela.
 */
export async function acaoConfigurarTela(
  id: string,
  nome: string,
  modo: string,
  estacaoId: string | null,
): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  const m = lerModo(modo, estacaoId);
  if ("erro" in m) {
    return { ok: false, motivo: m.erro };
  }
  try {
    await configurarTelaNoTenant(auth.sessao, id, { nome, modo: m.modo, estacaoId: m.estacaoId });
    revalidatePath("/config/telas");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível salvar a tela. Tente novamente." };
  }
}

export async function acaoRevogarTela(id: string): Promise<ResultadoAcao> {
  const auth = await autorizar("config:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await revogarTelaNoTenant(auth.sessao, id);
    revalidatePath("/config/telas");
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível revogar. Tente novamente." };
  }
}
