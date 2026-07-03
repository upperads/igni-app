"use server";

import { revalidatePath } from "next/cache";
import { type Acao, pode } from "@/domain/auth/rbac";
import { TIPOS_ITEM, type TipoItem } from "@/domain/orcamento/orcamento";
import { DadosInvalidosError } from "@/domain/shared/errors";
import { type SessaoUsuario, sessaoAtual } from "@/infra/auth/sessao";
import {
  criarServicoNoTenant,
  desativarServicoNoTenant,
  editarServicoNoTenant,
  reajustarPrecosNoTenant,
  reativarServicoNoTenant,
} from "@/infra/composition/servico";

/** Autorização no boundary: o catálogo é gerido por quem edita orçamento (dono/gestor/recepção). */
async function autorizar(acao: Acao): Promise<{ sessao: SessaoUsuario } | { erro: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { erro: "Sua sessão expirou. Entre novamente." };
  }
  if (!pode(sessao.papel, acao)) {
    return { erro: "Você não tem permissão para gerenciar o catálogo." };
  }
  return { sessao };
}

export interface ResultadoAcao {
  ok: boolean;
  motivo?: string;
}

/** Converte reais ("150" / "150,50") em centavos inteiros. Sem separador de milhar. */
function reaisParaCentavos(bruto: string): number | null {
  const v = bruto.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(v)) {
    return null;
  }
  return Math.round(Number.parseFloat(v) * 100);
}

function lerInput(
  tipo: string,
  nome: string,
  valor: string,
  markup: string,
): { nome: string; tipo: TipoItem; valorCentavos: number; markupPct: number } | { erro: string } {
  if (!TIPOS_ITEM.includes(tipo as TipoItem)) {
    return { erro: "Tipo inválido." };
  }
  if (!nome.trim()) {
    return { erro: "Dê um nome ao serviço." };
  }
  const valorCentavos = reaisParaCentavos(valor);
  if (valorCentavos === null) {
    return { erro: "Valor inválido." };
  }
  const markupPct = markup.trim() === "" ? 0 : Number.parseInt(markup, 10);
  if (!Number.isInteger(markupPct) || markupPct < 0) {
    return { erro: "Markup inválido." };
  }
  return { nome, tipo: tipo as TipoItem, valorCentavos, markupPct };
}

export async function acaoCriarServico(
  tipo: string,
  nome: string,
  valor: string,
  markup: string,
): Promise<ResultadoAcao> {
  const auth = await autorizar("orcamento:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  const input = lerInput(tipo, nome, valor, markup);
  if ("erro" in input) return { ok: false, motivo: input.erro };
  try {
    await criarServicoNoTenant(auth.sessao, input);
    revalidatePath("/servicos");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível criar o serviço." };
  }
}

export async function acaoEditarServico(
  id: string,
  tipo: string,
  nome: string,
  valor: string,
  markup: string,
): Promise<ResultadoAcao> {
  const auth = await autorizar("orcamento:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  const input = lerInput(tipo, nome, valor, markup);
  if ("erro" in input) return { ok: false, motivo: input.erro };
  try {
    await editarServicoNoTenant(auth.sessao, id, input);
    revalidatePath("/servicos");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível salvar o serviço." };
  }
}

export async function acaoDesativarServico(id: string): Promise<ResultadoAcao> {
  const auth = await autorizar("orcamento:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await desativarServicoNoTenant(auth.sessao, id);
    revalidatePath("/servicos");
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível desativar." };
  }
}

export async function acaoReativarServico(id: string): Promise<ResultadoAcao> {
  const auth = await autorizar("orcamento:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  try {
    await reativarServicoNoTenant(auth.sessao, id);
    revalidatePath("/servicos");
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível reativar." };
  }
}

export interface ResultadoReajuste {
  ok: boolean;
  motivo?: string;
  afetados?: number;
}

export async function acaoReajustar(pctBruto: string): Promise<ResultadoReajuste> {
  const auth = await autorizar("orcamento:editar");
  if ("erro" in auth) return { ok: false, motivo: auth.erro };
  const pct = Number.parseInt(pctBruto, 10);
  if (!Number.isInteger(pct)) {
    return { ok: false, motivo: "Informe um percentual inteiro (ex.: 10 ou -5)." };
  }
  try {
    const { afetados } = await reajustarPrecosNoTenant(auth.sessao, pct);
    revalidatePath("/servicos");
    return { ok: true, afetados };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) return { ok: false, motivo: erro.message };
    return { ok: false, motivo: "Não foi possível reajustar." };
  }
}
