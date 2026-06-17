/**
 * Ramos de oficina e o que cada template pré-carrega (RN-06 / US-01 / US-16).
 *
 * Esta é a fonte canônica do DOMÍNIO. O enum `template_ramo` do banco (infra) espelha estes
 * valores — um teste de drift garante que não divergem. Configurável em M8 (painel); por ora
 * é config-as-code (sem regra de negócio "chumbada" espalhada).
 *
 * Estações vêm do mundo descrito no PRD (bloco, cabeçote, virabrequim, bomba/bico…). Gates e
 * gatilhos de triagem também pertencem ao template, mas são consumidos pelos módulos M2
 * (máquina de estados) e M3 (triagem) — entram quando essas tabelas existirem.
 */

export const RAMOS = [
  "retifica_pesada_agro",
  "retifica_leve",
  "centro_automotivo",
] as const;

export type Ramo = (typeof RAMOS)[number];

export interface EstacaoTemplate {
  readonly nome: string;
  readonly ordem: number;
}

export const ESTACOES_POR_RAMO: Record<Ramo, readonly EstacaoTemplate[]> = {
  retifica_pesada_agro: [
    { nome: "Recebimento", ordem: 1 },
    { nome: "Desmontagem", ordem: 2 },
    { nome: "Metrologia", ordem: 3 },
    { nome: "Bloco", ordem: 4 },
    { nome: "Cabeçote", ordem: 5 },
    { nome: "Virabrequim", ordem: 6 },
    { nome: "Bomba/Bico", ordem: 7 },
    { nome: "Montagem", ordem: 8 },
    { nome: "Controle de Qualidade", ordem: 9 },
    { nome: "Expedição", ordem: 10 },
  ],
  retifica_leve: [
    { nome: "Recebimento", ordem: 1 },
    { nome: "Desmontagem", ordem: 2 },
    { nome: "Metrologia", ordem: 3 },
    { nome: "Bloco", ordem: 4 },
    { nome: "Cabeçote", ordem: 5 },
    { nome: "Montagem", ordem: 6 },
    { nome: "Controle de Qualidade", ordem: 7 },
    { nome: "Expedição", ordem: 8 },
  ],
  centro_automotivo: [
    { nome: "Recepção", ordem: 1 },
    { nome: "Diagnóstico", ordem: 2 },
    { nome: "Execução", ordem: 3 },
    { nome: "Controle de Qualidade", ordem: 4 },
    { nome: "Entrega", ordem: 5 },
  ],
};

export function estacoesDoRamo(ramo: Ramo): readonly EstacaoTemplate[] {
  return ESTACOES_POR_RAMO[ramo];
}
