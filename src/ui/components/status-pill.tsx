import { cn } from "@/ui/cn";
import { SINAL, type Sinal } from "@/ui/sinal";

/** Selo de triagem: ponto colorido + rótulo (cor nunca sozinha). */
export function StatusPill({ sinal, className }: { sinal: Sinal; className?: string }) {
  const info = SINAL[sinal];
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
