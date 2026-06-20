import type { Prioridade } from "@/domain/os/triagem";
import { cn } from "@/ui/cn";

/** Cor por bucket de prioridade da triagem. Cor + rótulo, nunca cor sozinha (03b / WCAG). */
const INFO: Record<Prioridade, { rotulo: string; bg: string }> = {
  critica: { rotulo: "Crítica", bg: "bg-sinal-vermelho" },
  alta: { rotulo: "Alta", bg: "bg-sinal-laranja" },
  normal: { rotulo: "Normal", bg: "bg-sinal-amarelo" },
  baixa: { rotulo: "Baixa", bg: "bg-sinal-azul" },
};

export function PrioridadeBadge({
  prioridade,
  className,
}: {
  prioridade: Prioridade;
  className?: string;
}) {
  const info = INFO[prioridade];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-grafite-600 bg-grafite-850 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-aco-200",
        className,
      )}
    >
      <span className={cn("size-2 rounded-full", info.bg)} aria-hidden />
      {info.rotulo}
    </span>
  );
}
