/**
 * Ramos de oficina e o que cada template pré-carrega (P-5a): SETORES com suas ESTAÇÕES.
 * Fonte canônica do domínio; o enum `template_ramo` do banco espelha `RAMOS` (teste de drift).
 * Setores de PEÇA agrupam várias estações; FASES viram setor-de-1-estação (o dono funde/apaga
 * o que não usa). Configurável por tenant depois do onboarding (tela /config/setores).
 */
export const RAMOS = ["retifica_pesada_agro", "retifica_leve", "centro_automotivo"] as const;
export type Ramo = (typeof RAMOS)[number];

export interface SetorTemplate {
  readonly nome: string;
  readonly ordem: number;
  readonly estacoes: readonly string[];
}

export const SETORES_POR_RAMO: Record<Ramo, readonly SetorTemplate[]> = {
  retifica_pesada_agro: [
    { nome: "Recebimento", ordem: 1, estacoes: ["Recebimento"] },
    { nome: "Desmontagem + lavagem", ordem: 2, estacoes: ["Desmontagem", "Lavagem"] },
    { nome: "Metrologia", ordem: 3, estacoes: ["Metrologia"] },
    { nome: "Usinagem", ordem: 4, estacoes: ["Bloco", "Cabeçote", "Virabrequim", "Biela", "Tornearia"] },
    { nome: "Bomba e bico", ordem: 5, estacoes: ["Bomba/Bico"] },
    { nome: "Montagem", ordem: 6, estacoes: ["Montagem"] },
    { nome: "Controle de Qualidade", ordem: 7, estacoes: ["Controle de Qualidade"] },
    { nome: "Expedição", ordem: 8, estacoes: ["Expedição"] },
  ],
  retifica_leve: [
    { nome: "Recebimento", ordem: 1, estacoes: ["Recebimento"] },
    { nome: "Desmontagem + lavagem", ordem: 2, estacoes: ["Desmontagem", "Lavagem"] },
    { nome: "Metrologia", ordem: 3, estacoes: ["Metrologia"] },
    { nome: "Usinagem", ordem: 4, estacoes: ["Bloco", "Cabeçote"] },
    { nome: "Montagem", ordem: 5, estacoes: ["Montagem"] },
    { nome: "Controle de Qualidade", ordem: 6, estacoes: ["Controle de Qualidade"] },
    { nome: "Expedição", ordem: 7, estacoes: ["Expedição"] },
  ],
  centro_automotivo: [
    { nome: "Recepção", ordem: 1, estacoes: ["Recepção"] },
    { nome: "Diagnóstico", ordem: 2, estacoes: ["Diagnóstico"] },
    { nome: "Execução", ordem: 3, estacoes: ["Execução"] },
    { nome: "Controle de Qualidade", ordem: 4, estacoes: ["Controle de Qualidade"] },
    { nome: "Entrega", ordem: 5, estacoes: ["Entrega"] },
  ],
};

export function setoresDoRamo(ramo: Ramo): readonly SetorTemplate[] {
  return SETORES_POR_RAMO[ramo];
}
