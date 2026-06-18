import { cn } from "@/ui/cn";

interface Props {
  rotulo: string;
  valor: string;
  unidade?: string;
  /** Destaca como manchete (ex.: atraso). */
  manchete?: boolean;
  /** Pinta o número de âmbar (atenção estrutural). */
  alarme?: boolean;
}

/** KPI de gestão: número grande em placa industrial + rótulo em instrumento. */
export function KpiStat({ rotulo, valor, unidade, manchete = false, alarme = false }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-grafite-800 px-4 py-3",
        manchete ? "border-ambar-600/60" : "border-grafite-700",
      )}
    >
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-display text-4xl leading-none tabular-nums",
            alarme ? "text-ambar-500" : "text-aco-100",
          )}
        >
          {valor}
        </span>
        {unidade ? <span className="font-mono text-xs text-aco-400">{unidade}</span> : null}
      </div>
      <div className="mt-1.5 font-mono text-[11px] uppercase tracking-widest text-aco-400">
        {rotulo}
      </div>
    </div>
  );
}
