/**
 * Paleta de SINAL/triagem (apresentação). O significado do sinal mora no domínio (`@/domain/os/painel`);
 * aqui ficam só as classes de cor e os rótulos. A triagem nunca depende só da cor: sempre cor +
 * rótulo + posição (WCAG / daltonismo). Tailwind lê os literais das classes.
 */
import type { Sinal } from "@/domain/os/painel";

export type { Sinal };

export interface SinalInfo {
  rotulo: string;
  /** Fundo: usado no ponto da pill. */
  bg: string;
  /** Texto: usado no cronômetro/realce. */
  texto: string;
  /** Cor crua (CSS var) — para a espinha-instrumento do card (gradiente de sangria). */
  cor: string;
}

export const SINAL: Record<Sinal, SinalInfo> = {
  critico: { rotulo: "Crítico", bg: "bg-sinal-vermelho", texto: "text-sinal-vermelho", cor: "var(--color-sinal-vermelho)" },
  atraso: { rotulo: "Atrasado", bg: "bg-sinal-laranja", texto: "text-sinal-laranja", cor: "var(--color-sinal-laranja)" },
  atencao: { rotulo: "Atenção", bg: "bg-sinal-amarelo", texto: "text-sinal-amarelo", cor: "var(--color-sinal-amarelo)" },
  emdia: { rotulo: "Em dia", bg: "bg-sinal-verde", texto: "text-sinal-verde", cor: "var(--color-sinal-verde)" },
  aguardando: { rotulo: "Aguardando", bg: "bg-sinal-azul", texto: "text-sinal-azul", cor: "var(--color-sinal-azul)" },
};
