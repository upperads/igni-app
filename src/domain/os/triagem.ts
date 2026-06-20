import type { EstadoOS } from "./estado";

/**
 * Triagem da OS (M3 / ADR-009): razão crítica + gatilhos do ramo (RN-02) e a regra da vez do
 * travamento (RN-03). Lógica pura: sem DB, sem framework, sem relógio embutido — quem chama injeta
 * `agora` e a `ConfigTriagem` (pesos/SLAs configuráveis, CLAUDE.md).
 */

export const PRIORIDADES = ["critica", "alta", "normal", "baixa"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

export const RESPONSABILIDADES = ["empresa", "cliente"] as const;
export type Responsabilidade = (typeof RESPONSABILIDADES)[number];

/** Ordem canônica das etapas (proxy de "trabalho restante" = etapas até `entregue`). */
const ORDEM_TRABALHO: readonly EstadoOS[] = [
  "aberta",
  "diagnostico",
  "orcamento",
  "aguardando_aprovacao",
  "aguardando_peca",
  "execucao",
  "controle_qualidade",
  "pronta",
  "entregue",
];

/** Etapas restantes até `entregue` na ordem canônica. `entregue` = 0. */
export function trabalhoRestante(estado: EstadoOS): number {
  const i = ORDEM_TRABALHO.indexOf(estado);
  return ORDEM_TRABALHO.length - 1 - i;
}

/** Dias de calendário (UTC) entre hoje e o prazo. Hoje = 0; passado = negativo; sem prazo = null. */
export function diasRestantesAte(prazoPrometido: string | null, agora: Date): number | null {
  if (!prazoPrometido) {
    return null;
  }
  const [ano, mes, dia] = prazoPrometido.split("-").map(Number);
  const prazoDia = Date.UTC(ano!, mes! - 1, dia!);
  const hojeDia = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate());
  return Math.round((prazoDia - hojeDia) / 86_400_000);
}

/** Gatilhos do ramo (RN-02), booleanos derivados dos dados da OS. */
export interface Gatilhos {
  frotaParada: boolean;
  maquinaUnica: boolean;
  retrabalhoGarantia: boolean;
}

export interface DadosGatilho {
  tipoCliente: "frota" | "produtor" | "avulso";
  maquinaUnica: boolean;
  /** Houve CQ reprovado (evento controle_qualidade → execucao) — derivável da linha do tempo. */
  houveCqReprovado: boolean;
}

export function gatilhosAtivos(d: DadosGatilho): Gatilhos {
  return {
    frotaParada: d.tipoCliente === "frota",
    maquinaUnica: d.maquinaUnica && d.tipoCliente === "produtor",
    retrabalhoGarantia: d.houveCqReprovado,
  };
}

/** Config configurável (CLAUDE.md): pesos dos gatilhos + do atraso, e os limiares (SLAs) dos buckets. */
export interface ConfigTriagem {
  pesos: {
    frotaParada: number;
    maquinaUnica: number;
    retrabalhoGarantia: number;
    /** Bônus aplicado quando a OS já está atrasada (dias restantes ≤ 0). */
    atraso: number;
  };
  /** Fronteiras de urgência (score), decrescentes: ≥ critica → crítica; ≥ alta → alta; ≥ normal → normal. */
  limiares: { critica: number; alta: number; normal: number };
}

export const CONFIG_TRIAGEM_PADRAO: ConfigTriagem = {
  pesos: { frotaParada: 3, maquinaUnica: 2, retrabalhoGarantia: 2, atraso: 5 },
  limiares: { critica: 8, alta: 4, normal: 1 },
};

/**
 * Urgência base a partir da razão crítica invertida: `trabalho_restante ÷ dias_restantes`. Mais
 * trabalho ou menos tempo → mais urgente. Sem prazo, não há pressão de prazo (base 0). Atrasado leva
 * um bônus fixo (o relógio já estourou).
 */
function urgenciaBase(
  diasRestantes: number | null,
  trabalho: number,
  config: ConfigTriagem,
): number {
  if (diasRestantes === null) {
    return 0;
  }
  const dias = Math.max(diasRestantes, 0.5);
  const base = trabalho / dias;
  return diasRestantes <= 0 ? base + config.pesos.atraso : base;
}

export function classificarPrioridade(score: number, config: ConfigTriagem): Prioridade {
  if (score >= config.limiares.critica) {
    return "critica";
  }
  if (score >= config.limiares.alta) {
    return "alta";
  }
  if (score >= config.limiares.normal) {
    return "normal";
  }
  return "baixa";
}

export interface EntradaTriagem {
  diasRestantes: number | null;
  trabalhoRestante: number;
  gatilhos: Gatilhos;
}

export interface ResultadoTriagem {
  score: number;
  prioridade: Prioridade;
}

/** Razão crítica + gatilhos → score de urgência e bucket de prioridade calculado (US-07). */
export function razaoCritica(
  entrada: EntradaTriagem,
  config: ConfigTriagem = CONFIG_TRIAGEM_PADRAO,
): ResultadoTriagem {
  let score = urgenciaBase(entrada.diasRestantes, entrada.trabalhoRestante, config);
  if (entrada.gatilhos.frotaParada) {
    score += config.pesos.frotaParada;
  }
  if (entrada.gatilhos.maquinaUnica) {
    score += config.pesos.maquinaUnica;
  }
  if (entrada.gatilhos.retrabalhoGarantia) {
    score += config.pesos.retrabalhoGarantia;
  }
  return { score, prioridade: classificarPrioridade(score, config) };
}

const RANK: Record<Prioridade, number> = { critica: 0, alta: 1, normal: 2, baixa: 3 };

/** "Perde a vez": só travado por culpa do CLIENTE (RN-03). Travado pela empresa mantém a vez. */
export function perdeAVez(travado: boolean, responsabilidade: Responsabilidade | null): boolean {
  return travado && responsabilidade === "cliente";
}

export interface ItemFila {
  prioridade: Prioridade;
  score: number;
  travado: boolean;
  travamentoResponsabilidade: Responsabilidade | null;
  criadoEm: Date;
}

/**
 * Ordena a fila por impacto (US-07) com a regra da vez (US-08 / RN-03): prioridade manda; dentro do
 * mesmo bucket, quem "perde a vez" (travado por culpa do cliente) cai para o fim; desempata por score
 * e, por fim, por ordem de chegada (FIFO). Não muda o score — só a vez. Função pura (não muta a entrada).
 */
export function ordenarFila<T extends ItemFila>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => {
    const rank = RANK[a.prioridade] - RANK[b.prioridade];
    if (rank !== 0) {
      return rank;
    }
    const vezA = perdeAVez(a.travado, a.travamentoResponsabilidade) ? 1 : 0;
    const vezB = perdeAVez(b.travado, b.travamentoResponsabilidade) ? 1 : 0;
    if (vezA !== vezB) {
      return vezA - vezB;
    }
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return a.criadoEm.getTime() - b.criadoEm.getTime();
  });
}
