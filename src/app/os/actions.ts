"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { AbrirOSInput } from "@/application/abrir-os";
import type { ItemEntrada } from "@/application/orcamento";
import { type Permissao, pode } from "@/domain/auth/cargo";
import { modalidadeValida } from "@/domain/os/entrada";
import type { EstadoOS } from "@/domain/os/estado";
import {
  type CanalAprovacao,
  CANAIS_APROVACAO,
  reaisParaCentavos,
  type TipoItem,
  TIPOS_ITEM,
} from "@/domain/orcamento/orcamento";
import {
  PRIORIDADES,
  type Prioridade,
  RESPONSABILIDADES,
  type Responsabilidade,
} from "@/domain/os/triagem";
import { DadosInvalidosError } from "@/domain/shared/errors";
import { type SessaoUsuario, sessaoAtual } from "@/infra/auth/sessao";
import { atribuirEstacaoNoTenant } from "@/infra/composition/config";
import {
  abrirOsNoTenant,
  ajustarPrioridadeNoTenant,
  aprovarCqNoTenant,
  aprovarOrcamentoNoTenant,
  destravarNoTenant,
  enviarOrcamentoNoTenant,
  montarOrcamentoNoTenant,
  reabrirOrcamentoNoTenant,
  recallNoTenant,
  recusarOrcamentoNoTenant,
  transicionarNoTenant,
  travarNoTenant,
} from "@/infra/composition/os";

/**
 * Autorização no BOUNDARY (RNF-SEC-02): resolve a sessão e CHECA o papel antes de qualquer mutação.
 * É a checagem que vale (o servidor), não só o read-only da UI. Retorna a sessão ou o motivo do erro.
 */
async function autorizar(acao: Permissao): Promise<{ sessao: SessaoUsuario } | { erro: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { erro: "Sua sessão expirou. Entre novamente." };
  }
  if (!pode(sessao.permissoes, acao)) {
    return { erro: "Você não tem permissão para essa ação." };
  }
  return { sessao };
}

/** Revalida as telas que mostram prioridade/travamento de uma OS. */
function revalidarOs(osId: string): void {
  revalidatePath(`/os/${osId}`);
  revalidatePath("/triagem");
  revalidatePath("/os");
}

const TIPOS_CLIENTE = ["frota", "produtor", "avulso"] as const;

type TipoCliente = (typeof TIPOS_CLIENTE)[number];

function vazioParaNulo(valor: string): string | null {
  const limpo = valor.trim();
  return limpo.length > 0 ? limpo : null;
}

export interface EstadoAbrirOs {
  erro?: string;
}

/** US-04 — abre a OS a partir do formulário e leva direto ao detalhe recém-criado. */
export async function acaoAbrirOs(
  _anterior: EstadoAbrirOs,
  formData: FormData,
): Promise<EstadoAbrirOs> {
  const auth = await autorizar("os:abrir");
  if ("erro" in auth) {
    return { erro: auth.erro };
  }
  const { sessao } = auth;

  const tipoCliente = String(formData.get("tipoCliente") ?? "");
  const modalidade = String(formData.get("modalidade") ?? "");
  if (!TIPOS_CLIENTE.includes(tipoCliente as TipoCliente)) {
    return { erro: "Selecione um tipo de cliente válido." };
  }
  if (!modalidadeValida(modalidade)) {
    return { erro: "Selecione uma modalidade de entrada válida." };
  }

  const input: AbrirOSInput = {
    cliente: {
      nome: String(formData.get("nome") ?? ""),
      contatoWhatsapp: vazioParaNulo(String(formData.get("whatsapp") ?? "")),
      tipo: tipoCliente as TipoCliente,
    },
    equipamento: {
      tipo: String(formData.get("tipoEquipamento") ?? ""),
      placa: vazioParaNulo(String(formData.get("placa") ?? "")),
      modeloMotor: vazioParaNulo(String(formData.get("modeloMotor") ?? "")),
    },
    entrada: {
      modalidade,
      modalidadeDescricao: vazioParaNulo(String(formData.get("modalidadeDescricao") ?? "")),
    },
    tipoServico: vazioParaNulo(String(formData.get("tipoServico") ?? "")),
  };

  let osId: string;
  try {
    const r = await abrirOsNoTenant(sessao, input);
    osId = r.osId;
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { erro: erro.message };
    }
    return { erro: "Não foi possível abrir a OS. Tente novamente." };
  }

  redirect(`/os/${osId}`);
}

export interface ResultadoAcao {
  ok: boolean;
  motivo?: string;
}

/**
 * US-05 — move a OS para o próximo estado. O contexto dos gates (orçamento aprovado / CQ aprovado)
 * é resolvido do DADO real pela composição (`resolverContextoGate`): sem orçamento aprovado, a
 * execução barra com o motivo; sem CQ aprovado, "pronta" barra. A regra de ouro lendo a verdade.
 */
export async function acaoTransicionar(
  osId: string,
  para: EstadoOS,
  motivo?: string,
  origem: "escritorio" | "chao" = "escritorio",
): Promise<ResultadoAcao> {
  const auth = await autorizar("os:avancar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  const { sessao } = auth;

  try {
    const r = await transicionarNoTenant(sessao, { osId, para, motivo, origem });
    if (r.ok) {
      revalidarOs(osId);
    }
    return { ok: r.ok, motivo: r.motivo };
  } catch {
    return { ok: false, motivo: "Não foi possível avançar a OS. Tente novamente." };
  }
}

/** Bump a partir da TELA DE CHÃO (marca origem='chao' — a métrica de adoção). 1 toque, sem digitar. */
export async function acaoBumpChao(osId: string, para: EstadoOS): Promise<ResultadoAcao> {
  return acaoTransicionar(osId, para, undefined, "chao");
}

/** US-10 — recall: desfaz a última transição da OS. */
export async function acaoRecall(osId: string): Promise<ResultadoAcao> {
  const auth = await autorizar("os:avancar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  const { sessao } = auth;
  try {
    const r = await recallNoTenant(sessao, osId);
    if (r.ok) {
      revalidarOs(osId);
    }
    return { ok: r.ok, motivo: r.motivo };
  } catch {
    return { ok: false, motivo: "Não foi possível desfazer. Tente novamente." };
  }
}

/** US-08 — trava a OS com motivo e responsabilidade (empresa/cliente). */
export async function acaoTravar(
  osId: string,
  motivo: string,
  responsabilidade: string,
): Promise<ResultadoAcao> {
  const auth = await autorizar("os:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  const { sessao } = auth;
  if (!RESPONSABILIDADES.includes(responsabilidade as Responsabilidade)) {
    return { ok: false, motivo: "Selecione de quem é a responsabilidade." };
  }
  const m = motivo.trim();
  if (!m) {
    return { ok: false, motivo: "Diga o porquê do travamento." };
  }
  try {
    await travarNoTenant(sessao, {
      osId,
      motivo: m,
      responsabilidade: responsabilidade as Responsabilidade,
    });
    revalidarOs(osId);
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível travar a OS. Tente novamente." };
  }
}

/** I7 — atribui (ou tira, com estacaoId vazio) a estação física onde a OS está no chão. */
export async function acaoAtribuirEstacao(
  osId: string,
  estacaoId: string,
): Promise<ResultadoAcao> {
  const auth = await autorizar("os:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await atribuirEstacaoNoTenant(auth.sessao, osId, estacaoId === "" ? null : estacaoId);
    revalidarOs(osId);
    revalidatePath("/chao");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível mudar a estação. Tente novamente." };
  }
}

/** US-08 — destrava a OS. */
export async function acaoDestravar(osId: string): Promise<ResultadoAcao> {
  const auth = await autorizar("os:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  const { sessao } = auth;
  try {
    await destravarNoTenant(sessao, osId);
    revalidarOs(osId);
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível destravar a OS. Tente novamente." };
  }
}

/** US-07 — override humano da prioridade (registrado). */
export async function acaoAjustarPrioridade(
  osId: string,
  prioridade: string,
  motivo: string,
): Promise<ResultadoAcao> {
  const auth = await autorizar("triagem:override");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  const { sessao } = auth;
  if (!PRIORIDADES.includes(prioridade as Prioridade)) {
    return { ok: false, motivo: "Selecione uma prioridade válida." };
  }
  try {
    await ajustarPrioridadeNoTenant(sessao, {
      osId,
      prioridade: prioridade as Prioridade,
      motivo: motivo.trim() || undefined,
    });
    revalidarOs(osId);
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Não foi possível ajustar a prioridade. Tente novamente." };
  }
}

// --- Orçamento (M5 / US-12) — RBAC: dono/gestor/recepção editam; produção só lê ---

export interface ItemFormulario {
  tipo: string;
  descricao: string;
  valor: string;
  markup: string;
}

/** US-12 — monta/edita os itens do orçamento (substitui a lista). */
export async function acaoMontarOrcamento(
  osId: string,
  itensForm: ItemFormulario[],
): Promise<ResultadoAcao> {
  const auth = await autorizar("orcamento:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  const itens: ItemEntrada[] = [];
  for (const f of itensForm) {
    if (!TIPOS_ITEM.includes(f.tipo as TipoItem)) {
      return { ok: false, motivo: "Item com tipo inválido." };
    }
    if (!f.descricao.trim()) {
      return { ok: false, motivo: "Todo item precisa de descrição." };
    }
    const valorCentavos = reaisParaCentavos(f.valor);
    if (valorCentavos === null) {
      return { ok: false, motivo: `Valor inválido em "${f.descricao.trim()}".` };
    }
    const markup = f.markup.trim() === "" ? 0 : Number.parseInt(f.markup, 10);
    if (!Number.isInteger(markup) || markup < 0) {
      return { ok: false, motivo: "Markup inválido (use um percentual inteiro)." };
    }
    itens.push({ tipo: f.tipo as TipoItem, descricao: f.descricao, valorCentavos, markupPct: markup });
  }

  try {
    await montarOrcamentoNoTenant(auth.sessao, { osId, itens });
    revalidarOs(osId);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível salvar o orçamento. Tente novamente." };
  }
}

export interface ResultadoEnvio {
  ok: boolean;
  motivo?: string;
  token?: string;
}

/** US-12 — envia o orçamento ao cliente (gera o link com token). */
export async function acaoEnviarOrcamento(osId: string): Promise<ResultadoEnvio> {
  const auth = await autorizar("orcamento:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    const { token } = await enviarOrcamentoNoTenant(auth.sessao, osId);
    revalidarOs(osId);
    return { ok: true, token };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível enviar o orçamento. Tente novamente." };
  }
}

async function decidirOrcamento(
  osId: string,
  decidir: (sessao: SessaoUsuario) => Promise<void>,
  falha: string,
): Promise<ResultadoAcao> {
  const auth = await autorizar("orcamento:editar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await decidir(auth.sessao);
    revalidarOs(osId);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: falha };
  }
}

/**
 * US-12/14 — aprovação interna: o cliente aprovou por fora (telefone/pessoalmente/WhatsApp) e a
 * operação registra. O `canal` documenta COMO, gravando um evento na linha do tempo (mantém a
 * responsabilização honesta). Libera o gate de execução.
 */
export async function acaoAprovarOrcamento(
  osId: string,
  canal: string,
): Promise<ResultadoAcao> {
  if (!CANAIS_APROVACAO.includes(canal as CanalAprovacao)) {
    return { ok: false, motivo: "Diga como o cliente aprovou (telefone, pessoalmente ou WhatsApp)." };
  }
  return decidirOrcamento(
    osId,
    (s) => aprovarOrcamentoNoTenant(s, osId, canal as CanalAprovacao),
    "Não foi possível aprovar o orçamento.",
  );
}

/** US-14 — recusa interna: volta a OS a diagnóstico. */
export async function acaoRecusarOrcamento(osId: string): Promise<ResultadoAcao> {
  return decidirOrcamento(
    osId,
    (s) => recusarOrcamentoNoTenant(s, osId),
    "Não foi possível recusar o orçamento.",
  );
}

/** US-12 — reabre um orçamento recusado para renegociar. */
export async function acaoReabrirOrcamento(osId: string): Promise<ResultadoAcao> {
  return decidirOrcamento(
    osId,
    (s) => reabrirOrcamentoNoTenant(s, osId),
    "Não foi possível reabrir o orçamento.",
  );
}

/** US-12 (gate CQ) — aprova o controle de qualidade. Produção pode (é ação de chão). */
export async function acaoAprovarCq(osId: string): Promise<ResultadoAcao> {
  const auth = await autorizar("os:avancar");
  if ("erro" in auth) {
    return { ok: false, motivo: auth.erro };
  }
  try {
    await aprovarCqNoTenant(auth.sessao, osId);
    revalidarOs(osId);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { ok: false, motivo: erro.message };
    }
    return { ok: false, motivo: "Não foi possível aprovar o CQ. Tente novamente." };
  }
}
