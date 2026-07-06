import { type EstadoOS, quatroPerguntas } from "./estado";
import type { Prioridade, Responsabilidade } from "./triagem";

/**
 * Painel de setor e KPIs de gestão (M4 / US-09/11). Lógica pura: traduz o estado da OS no SINAL de
 * triagem (cor + rótulo + posição) e calcula os indicadores, com o atraso SEPARANDO A CULPA (RN-03).
 * A apresentação (classes de cor, rótulos visuais) mora na UI; aqui é só o significado.
 */

export const SINAIS = ["critico", "atraso", "atencao", "emdia", "aguardando"] as const;
export type Sinal = (typeof SINAIS)[number];

/**
 * Sinal de triagem de uma OS, por precedência: travado cede ao "aguardando" (parado); senão crítica
 * acende vermelho; senão prazo vencido é atraso; senão alta pede atenção; senão em dia.
 */
export function sinalDaOs(args: {
  prioridade: Prioridade;
  travado: boolean;
  diasRestantes: number | null;
}): Sinal {
  if (args.travado) {
    return "aguardando";
  }
  if (args.prioridade === "critica") {
    return "critico";
  }
  if (args.diasRestantes !== null && args.diasRestantes < 0) {
    return "atraso";
  }
  if (args.prioridade === "alta") {
    return "atencao";
  }
  return "emdia";
}

/** De quem é a culpa do atraso (RF-12): cliente (travado por ele), peça (aguardando peça) ou nossa. */
export type CulpaAtraso = "nossa" | "cliente" | "peca";

export function culpaDoAtraso(args: {
  travado: boolean;
  responsabilidade: Responsabilidade | null;
  estado: EstadoOS;
}): CulpaAtraso {
  if (args.travado && args.responsabilidade === "cliente") {
    return "cliente";
  }
  if (args.estado === "aguardando_peca") {
    return "peca";
  }
  return "nossa";
}

/** De quem é a bola, na visão interna (o pilar): oficina / cliente / peça. */
export type Bola = "oficina" | "cliente" | "peca";

/**
 * "De quem é a bola" a partir do estado + contexto. Lógica pura (era da page do detalhe).
 *
 * PONTO CHAVE (bug de campo, reunião 05/07): em `aguardando_aprovacao`, a bola só é do CLIENTE
 * enquanto o orçamento AINDA NÃO foi aprovado. Depois que o cliente aprova, a OS ainda fica em
 * `aguardando_aprovacao` (mover para peça/execução é o 2º passo, da operação) — mas a bola já é da
 * OFICINA, e o texto orienta o próximo passo. Sem isto, o card dizia "esperando o cliente aprovar"
 * mesmo com o orçamento já aprovado.
 */
export function calcularBola(args: {
  estado: EstadoOS;
  orcamentoAprovado: boolean;
  travado: boolean;
  travamentoResponsabilidade: Responsabilidade | null;
  travamentoMotivo: string | null;
}): { bola: Bola; detalhe: string } {
  if (args.estado === "aguardando_aprovacao" && !args.orcamentoAprovado) {
    return { bola: "cliente", detalhe: "Esperando o cliente aprovar o orçamento enviado." };
  }
  if (args.estado === "aguardando_aprovacao" && args.orcamentoAprovado) {
    return { bola: "oficina", detalhe: "Orçamento aprovado — mova a OS para peça ou execução." };
  }
  if (args.travado && args.travamentoResponsabilidade === "cliente") {
    return { bola: "cliente", detalhe: args.travamentoMotivo ?? "Travado por uma pendência do cliente." };
  }
  if (args.estado === "aguardando_peca") {
    return { bola: "peca", detalhe: "Aguardando a peça chegar para seguir." };
  }
  if (args.travado) {
    return { bola: "oficina", detalhe: args.travamentoMotivo ?? "Travado, e a resolução é nossa." };
  }
  return { bola: "oficina", detalhe: `${quatroPerguntas(args.estado).oQueFalta}.` };
}

export interface ItemKpi {
  prioridade: Prioridade;
  travado: boolean;
  travamentoResponsabilidade: Responsabilidade | null;
  estado: EstadoOS;
  diasRestantes: number | null;
}

export interface Kpis {
  /** OS ativas (não entregues) na casa. */
  naCasa: number;
  /** Paradas em prioridade crítica. */
  paradaCritica: number;
  /** Travadas (qualquer responsabilidade). */
  travadas: number;
  /** Atrasadas (prazo vencido), com a culpa separada — a manchete do painel. */
  atraso: { total: number; nossa: number; cliente: number; peca: number };
}

/**
 * Histórico de responsabilização (o diferencial, sobre a linha do tempo — sem tabela nova, ADR/SDD).
 * Conta os EPISÓDIOS de espera/retrabalho por responsável, a partir dos eventos de transição:
 * entrar em `aguardando_aprovacao` = bola foi do cliente; em `aguardando_peca` = peça; voltar do
 * CQ para execução (retrabalho) = nossa. É "de quem FOI a bola" no período. Pura, sem relógio.
 */
export interface EventoTransicao {
  deEstado: EstadoOS | null;
  paraEstado: EstadoOS;
}

export interface ResumoCulpa {
  total: number;
  nossa: number;
  cliente: number;
  peca: number;
}

export function resumoCulpa(eventos: readonly EventoTransicao[]): ResumoCulpa {
  const r: ResumoCulpa = { total: 0, nossa: 0, cliente: 0, peca: 0 };
  for (const e of eventos) {
    if (e.paraEstado === "aguardando_aprovacao") {
      r.cliente += 1;
      r.total += 1;
    } else if (e.paraEstado === "aguardando_peca") {
      r.peca += 1;
      r.total += 1;
    } else if (e.deEstado === "controle_qualidade" && e.paraEstado === "execucao") {
      r.nossa += 1;
      r.total += 1;
    }
  }
  return r;
}

/**
 * Métricas de GESTÃO do período (P1 — o que torna o Igni vendável). Tudo on-read sobre `evento`,
 * sem tabela nova. Dá ao dono dois números que justificam o preço:
 *  - ADOÇÃO DO CHÃO: % dos avanços feitos pelo chão (o teste do Régis; prova que a equipe usa);
 *  - RESPONSABILIZAÇÃO: de quem foi a bola + % das esperas FORA da alçada da oficina (cliente/peça).
 */
export interface EventoGestao {
  deEstado: EstadoOS | null;
  paraEstado: EstadoOS;
  origem: string;
}

export interface MetricasAdocao {
  /** Transições reais (exclui a abertura da OS). */
  total: number;
  chao: number;
  escritorio: number;
  /** % dos avanços feitos pelo chão (0–100, inteiro). */
  pctChao: number;
}

export interface RelatorioGestao {
  adocao: MetricasAdocao;
  culpa: ResumoCulpa;
  /** % das esperas que NÃO foram da oficina (cliente + peça), 0–100. */
  pctForaDaAlcada: number;
}

function pct(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * 100);
}

export function metricasAdocao(eventos: readonly EventoGestao[]): MetricasAdocao {
  let total = 0;
  let chao = 0;
  for (const e of eventos) {
    if (e.deEstado === null) {
      continue; // abertura não é "avanço"
    }
    total += 1;
    if (e.origem === "chao") {
      chao += 1;
    }
  }
  return { total, chao, escritorio: total - chao, pctChao: pct(chao, total) };
}

export function relatorioGestao(eventos: readonly EventoGestao[]): RelatorioGestao {
  const adocao = metricasAdocao(eventos);
  const culpa = resumoCulpa(eventos);
  return { adocao, culpa, pctForaDaAlcada: pct(culpa.cliente + culpa.peca, culpa.total) };
}

/** Calcula os KPIs de gestão sobre as OS ativas (US-11). Espera receber só as não entregues. */
export function calcularKpis(oss: readonly ItemKpi[]): Kpis {
  const kpis: Kpis = {
    naCasa: oss.length,
    paradaCritica: 0,
    travadas: 0,
    atraso: { total: 0, nossa: 0, cliente: 0, peca: 0 },
  };
  for (const os of oss) {
    if (os.prioridade === "critica") {
      kpis.paradaCritica += 1;
    }
    if (os.travado) {
      kpis.travadas += 1;
    }
    if (os.diasRestantes !== null && os.diasRestantes < 0) {
      kpis.atraso.total += 1;
      const culpa = culpaDoAtraso({
        travado: os.travado,
        responsabilidade: os.travamentoResponsabilidade,
        estado: os.estado,
      });
      kpis.atraso[culpa] += 1;
    }
  }
  return kpis;
}
