import type { Responsabilidade } from "@/domain/os/triagem";
import { cn } from "@/ui/cn";

/** De quem é a bola enquanto a OS está travada (RN-03). */
export const RESPONSABILIDADE_ROTULO: Record<Responsabilidade, string> = {
  empresa: "Bola com a oficina",
  cliente: "Bola com o cliente",
};

/** Selo de travamento: a OS está parada e por culpa de quem. Dimensão separada da prioridade. */
export function TravamentoSelo({
  responsabilidade,
  className,
}: {
  responsabilidade: Responsabilidade | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-ambar-600/50 bg-grafite-850 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-ambar-500",
        className,
      )}
    >
      <span aria-hidden>⏸</span>
      Travado
      {responsabilidade ? ` · ${RESPONSABILIDADE_ROTULO[responsabilidade]}` : ""}
    </span>
  );
}
