import { assertNever } from "@/domain/shared/assert-never";

/**
 * Máquina de estados da OS (ADR-008). Lógica pura: sem DB, sem framework. Define os estados, as
 * transições permitidas (incluindo os fluxos de exceção do PRD) e os 3 gates inegociáveis (RN-01).
 * Travamento e prioridade são dimensões separadas (M3), não estados.
 */
export const ESTADOS_OS = [
  "aberta",
  "diagnostico",
  "orcamento",
  "aguardando_aprovacao",
  "aguardando_peca",
  "execucao",
  "controle_qualidade",
  "pronta",
  "entregue",
] as const;

export type EstadoOS = (typeof ESTADOS_OS)[number];

/** Rótulos legíveis dos estados (pt-BR), para a UI. */
export const ROTULOS_ESTADO: Record<EstadoOS, string> = {
  aberta: "Aberta",
  diagnostico: "Diagnóstico",
  orcamento: "Orçamento",
  aguardando_aprovacao: "Aguardando aprovação",
  aguardando_peca: "Aguardando peça",
  execucao: "Execução",
  controle_qualidade: "Controle de qualidade",
  pronta: "Pronta",
  entregue: "Entregue",
};

export function rotuloEstado(estado: EstadoOS): string {
  return ROTULOS_ESTADO[estado];
}

/** Insumos dos gates, resolvidos pela aplicação (status do orçamento, resultado do CQ). */
export interface ContextoTransicao {
  orcamentoAprovado: boolean;
  cqAprovado: boolean;
}

export interface ResultadoTransicao {
  ok: boolean;
  /** Quando barrada, explica o que falta (prevenção de erro). */
  motivo?: string;
}

const MOTIVO_INVALIDA = "Transição inválida para o estado atual.";
const MOTIVO_GATE_ORCAMENTO = "Não usina sem orçamento aprovado.";
const MOTIVO_GATE_CQ = "Não passa do CQ sem aprovação no controle de qualidade.";

/** Transições estruturalmente permitidas (antes dos gates). */
const TRANSICOES: Record<EstadoOS, readonly EstadoOS[]> = {
  aberta: ["diagnostico"],
  diagnostico: ["orcamento"],
  orcamento: ["aguardando_aprovacao"],
  // aprovado → peça ou execução; recusado → volta a diagnóstico (renegociação).
  aguardando_aprovacao: ["aguardando_peca", "execucao", "diagnostico"],
  aguardando_peca: ["execucao"],
  execucao: ["controle_qualidade"],
  // aprovado → pronta; reprovado → volta a execução (retrabalho).
  controle_qualidade: ["pronta", "execucao"],
  pronta: ["entregue"],
  entregue: [],
};

export function proximosEstados(de: EstadoOS): readonly EstadoOS[] {
  return TRANSICOES[de];
}

/**
 * O "bump" (US-10): o único passo adiante, quando não há decisão a tomar. Retorna null nos estados
 * que ramificam (decisão do cliente/CQ) — esses não se avançam por toque, exigem a tela de detalhe —
 * e no estado final. Gates ainda valem: o bump para um destino gated pode ser barrado na execução.
 */
export function proximoBump(estado: EstadoOS): EstadoOS | null {
  const prox = TRANSICOES[estado];
  return prox.length === 1 ? prox[0]! : null;
}

/** Valida uma transição: estrutura + gates (RN-01). */
export function validarTransicao(
  de: EstadoOS,
  para: EstadoOS,
  contexto: ContextoTransicao,
): ResultadoTransicao {
  if (!TRANSICOES[de].includes(para)) {
    return { ok: false, motivo: MOTIVO_INVALIDA };
  }
  // Gate: não usina sem orçamento aprovado.
  if (para === "execucao" && !contexto.orcamentoAprovado) {
    return { ok: false, motivo: MOTIVO_GATE_ORCAMENTO };
  }
  // Gate: não passa do CQ sem aprovação.
  if (de === "controle_qualidade" && para === "pronta" && !contexto.cqAprovado) {
    return { ok: false, motivo: MOTIVO_GATE_CQ };
  }
  return { ok: true };
}

export interface QuatroPerguntas {
  onde: string;
  porque: string;
  oQueFalta: string;
  praOnde: string;
}

/** As 4 perguntas (RN-04), derivadas puramente do estado. Toda OS sempre as responde. */
export function quatroPerguntas(estado: EstadoOS): QuatroPerguntas {
  switch (estado) {
    case "aberta":
      return { onde: "Recebida, na fila de diagnóstico", porque: "Ainda não iniciada", oQueFalta: "Começar o diagnóstico (desmontagem e metrologia)", praOnde: "Diagnóstico" };
    case "diagnostico":
      return { onde: "Em diagnóstico", porque: "Avaliando o serviço", oQueFalta: "Concluir o laudo e montar o orçamento", praOnde: "Orçamento" };
    case "orcamento":
      return { onde: "Montando o orçamento", porque: "Orçamento em preparação", oQueFalta: "Enviar o orçamento ao cliente", praOnde: "Aguardando aprovação" };
    case "aguardando_aprovacao":
      return { onde: "Orçamento enviado", porque: "Aguardando a decisão do cliente", oQueFalta: "Aprovação do cliente pelo link", praOnde: "Compra de peça ou execução, se aprovado" };
    case "aguardando_peca":
      return { onde: "Aguardando peça", porque: "Peça em compra ou trânsito", oQueFalta: "A peça chegar", praOnde: "Execução" };
    case "execucao":
      return { onde: "Em execução nas estações", porque: "Serviço em andamento", oQueFalta: "Concluir a usinagem", praOnde: "Controle de qualidade" };
    case "controle_qualidade":
      return { onde: "No controle de qualidade", porque: "Em teste de bancada", oQueFalta: "Aprovação no CQ", praOnde: "Pronta, se aprovado; retrabalho, se não" };
    case "pronta":
      return { onde: "Pronta", porque: "Concluída e aprovada", oQueFalta: "Entrega ou retirada", praOnde: "Entregue" };
    case "entregue":
      return { onde: "Entregue", porque: "Finalizada", oQueFalta: "Nada", praOnde: "—" };
    default:
      return assertNever(estado, "Estado de OS não tratado");
  }
}
