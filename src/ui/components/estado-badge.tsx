import { type EstadoOS, rotuloEstado } from "@/domain/os/estado";
import { cn } from "@/ui/cn";

/** Cor por estado do ciclo da OS. Triagem (risco/SLA) é dimensão separada — isto é fase, não alarme. */
const COR_ESTADO: Record<EstadoOS, string> = {
  aberta: "bg-aco-400",
  diagnostico: "bg-sinal-azul",
  orcamento: "bg-sinal-azul",
  aguardando_aprovacao: "bg-ambar-500",
  aguardando_peca: "bg-sinal-azul",
  execucao: "bg-sinal-amarelo",
  controle_qualidade: "bg-sinal-amarelo",
  pronta: "bg-sinal-verde",
  entregue: "bg-grafite-600",
};

/** Selo do estado da OS: ponto colorido + rótulo legível (cor nunca sozinha). */
export function EstadoBadge({ estado, className }: { estado: EstadoOS; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-grafite-600 bg-grafite-850 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-aco-200",
        className,
      )}
    >
      <span className={cn("size-2 rounded-full", COR_ESTADO[estado])} aria-hidden />
      {rotuloEstado(estado)}
    </span>
  );
}
