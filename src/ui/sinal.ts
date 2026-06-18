/**
 * Paleta de SINAL/triagem. A triagem nunca depende só da cor: sempre cor + rótulo + posição
 * (WCAG / daltonismo). Cada sinal carrega o rótulo e as classes de cor (Tailwind lê os literais).
 */
export type Sinal = "critico" | "atraso" | "atencao" | "emdia" | "aguardando";

export interface SinalInfo {
  rotulo: string;
  /** Fundo: usado na espinha de status e no ponto da pill. */
  bg: string;
  /** Texto: usado no cronômetro/realce. */
  texto: string;
}

export const SINAL: Record<Sinal, SinalInfo> = {
  critico: { rotulo: "Crítico", bg: "bg-sinal-vermelho", texto: "text-sinal-vermelho" },
  atraso: { rotulo: "Atrasado", bg: "bg-sinal-laranja", texto: "text-sinal-laranja" },
  atencao: { rotulo: "Atenção", bg: "bg-sinal-amarelo", texto: "text-sinal-amarelo" },
  emdia: { rotulo: "Em dia", bg: "bg-sinal-verde", texto: "text-sinal-verde" },
  aguardando: { rotulo: "Aguardando", bg: "bg-sinal-azul", texto: "text-sinal-azul" },
};
