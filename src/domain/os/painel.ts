import type { EstadoOS } from "./estado";
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
