/**
 * Orçamento (M5 / US-12): status, regras de transição e totais. Lógica pura — dinheiro em centavos
 * inteiros (sem drift), markup em percentual inteiro. O gate de execução (RN-01) lê `aprovado()`.
 */

export const STATUS_ORCAMENTO = ["rascunho", "enviado", "aprovado", "recusado"] as const;
export type StatusOrcamento = (typeof STATUS_ORCAMENTO)[number];

export const TIPOS_ITEM = ["peca", "mao_de_obra", "terceiro"] as const;
export type TipoItem = (typeof TIPOS_ITEM)[number];

export const ROTULO_TIPO_ITEM: Record<TipoItem, string> = {
  peca: "Peça",
  mao_de_obra: "Mão de obra",
  terceiro: "Terceiro",
};

/** Itens só se editam no rascunho. */
export function podeEditarItens(status: StatusOrcamento): boolean {
  return status === "rascunho";
}

/** Envia ao cliente: precisa estar em rascunho e ter ao menos um item. */
export function podeEnviar(status: StatusOrcamento, qtdItens: number): boolean {
  return status === "rascunho" && qtdItens > 0;
}

/** Decisão do cliente (aprovar/recusar) só vale no enviado. */
export function podeDecidir(status: StatusOrcamento): boolean {
  return status === "enviado";
}

/** Recusado pode voltar a rascunho para renegociar. */
export function podeReabrir(status: StatusOrcamento): boolean {
  return status === "recusado";
}

/** O gate de execução (RN-01) passa quando o orçamento está aprovado. */
export function aprovado(status: StatusOrcamento): boolean {
  return status === "aprovado";
}

export interface ItemOrcamento {
  tipo: TipoItem;
  valorCentavos: number;
  markupPct: number;
}

/** Total de um item: valor + markup (terceiro com %). Em centavos inteiros. */
export function totalItem(item: { valorCentavos: number; markupPct: number }): number {
  return item.valorCentavos + Math.round((item.valorCentavos * item.markupPct) / 100);
}

export interface TotaisOrcamento {
  porTipo: Record<TipoItem, number>;
  total: number;
}

/** Subtotais por tipo + total geral, tudo em centavos. */
export function calcularOrcamento(itens: readonly ItemOrcamento[]): TotaisOrcamento {
  const porTipo: Record<TipoItem, number> = { peca: 0, mao_de_obra: 0, terceiro: 0 };
  for (const item of itens) {
    porTipo[item.tipo] += totalItem(item);
  }
  return { porTipo, total: porTipo.peca + porTipo.mao_de_obra + porTipo.terceiro };
}
