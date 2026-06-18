import { cn } from "@/ui/cn";
import { SINAL, type Sinal } from "@/ui/sinal";

interface Props {
  codigo: string;
  equipamento: string;
  responsavel: string | null;
  /** Prazo restante (ex.: "03d") ou "—". */
  prazo: string;
  sinal: Sinal;
  travado?: boolean;
}

/**
 * Card de OS — a unidade do board. A ESPINHA DE STATUS (faixa lateral grossa na cor da triagem)
 * é a assinatura; o cronômetro herda a cor do sinal. Código e prazo em mono (leitura de instrumento).
 */
export function OsCard({ codigo, equipamento, responsavel, prazo, sinal, travado = false }: Props) {
  const info = SINAL[sinal];
  return (
    <article className="relative flex overflow-hidden rounded-md border border-grafite-700 bg-grafite-800">
      <span className={cn("w-1.5 shrink-0", info.bg)} aria-hidden />
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-medium text-aco-100">{codigo}</span>
          {travado ? (
            <span className="inline-flex items-center gap-1 rounded bg-grafite-700 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-aco-200">
              <span aria-hidden>⏸</span> Travado
            </span>
          ) : null}
        </div>
        <p className="font-display text-lg leading-tight text-aco-100">{equipamento}</p>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate font-body text-xs text-aco-400">
            {responsavel ?? "— sem responsável"}
          </span>
          <span className={cn("font-mono text-xs tabular-nums", info.texto)}>{prazo}</span>
        </div>
      </div>
    </article>
  );
}
