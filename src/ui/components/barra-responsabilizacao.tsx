import { cn } from "@/ui/cn";

/** Distribuição por responsável (oficina/cliente/peça) — o diferencial do Igni, num instrumento. */
export interface DistribuicaoCulpa {
  total: number;
  nossa: number;
  cliente: number;
  peca: number;
}

const SEG = [
  { k: "nossa" as const, rotulo: "Oficina", cor: "var(--color-aco-400)", texto: "text-aco-300" },
  { k: "cliente" as const, rotulo: "Cliente", cor: "var(--color-ambar-500)", texto: "text-ambar-500" },
  { k: "peca" as const, rotulo: "Peça", cor: "var(--color-sinal-laranja)", texto: "text-sinal-laranja" },
];

/**
 * Barra de responsabilização: de quem é/foi a bola, somado, num instrumento de relance. O que
 * nenhum concorrente mostra (pesquisa 08). Serve o ao-vivo (atraso agora) e o histórico (período).
 * Não renderiza quando não há nada a responsabilizar.
 */
export function BarraResponsabilizacao({
  titulo,
  sufixo,
  dist,
  className,
}: {
  titulo: string;
  sufixo: string;
  dist: DistribuicaoCulpa;
  className?: string;
}) {
  if (dist.total === 0) {
    return null;
  }
  return (
    <section
      aria-label={titulo}
      className={cn("rounded-lg border border-ambar-600/40 bg-grafite-800 p-4", className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-aco-400">{titulo}</span>
        <span className="font-mono text-sm tabular-nums text-aco-200">
          {dist.total} {sufixo}
        </span>
      </div>

      <div className="mt-3 flex h-3 overflow-hidden rounded-full" role="img" aria-hidden>
        {SEG.map((s) =>
          dist[s.k] > 0 ? (
            <span
              key={s.k}
              style={{ background: s.cor, width: `${(dist[s.k] / dist.total) * 100}%` }}
            />
          ) : null,
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1">
        {SEG.map((s) => (
          <span key={s.k} className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums">
            <span className="size-2 rounded-full" style={{ background: s.cor }} aria-hidden />
            <span className={s.texto}>{dist[s.k]}</span>
            <span className="text-aco-400">{s.rotulo}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
