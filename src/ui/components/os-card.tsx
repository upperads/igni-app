import type { Responsabilidade } from "@/domain/os/triagem";
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
  /** De quem é a bola quando travado (o pilar: responsabilização visível no board). */
  responsabilidade?: Responsabilidade | null;
}

/**
 * Card de OS — a unidade do board. A ESPINHA DE STATUS é a assinatura: uma linha de instrumento
 * nítida na cor da triagem + uma sangria curta da cor para dentro do card (gauge, não "borda
 * colorida" genérica). O cronômetro herda a cor do sinal. Código e prazo em mono (leitura de instrumento).
 */
export function OsCard({
  codigo,
  equipamento,
  responsavel,
  prazo,
  sinal,
  travado = false,
  responsabilidade = null,
}: Props) {
  const info = SINAL[sinal];
  const bolaCliente = travado && responsabilidade === "cliente";
  return (
    <article className="relative overflow-hidden rounded-md border border-grafite-700 bg-grafite-800">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-4"
        style={{
          background: `linear-gradient(to right, ${info.cor} 0, ${info.cor} 2px, color-mix(in oklch, ${info.cor} 20%, transparent) 2px, transparent 100%)`,
        }}
      />
      <div className="flex flex-1 flex-col gap-1.5 p-3 pl-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-medium text-aco-100">{codigo}</span>
          {travado ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
                bolaCliente
                  ? "bg-ambar-600/25 text-ambar-500"
                  : "bg-grafite-700 text-aco-200",
              )}
            >
              <span aria-hidden>⏸</span>
              {responsabilidade ? `Bola: ${bolaCliente ? "cliente" : "oficina"}` : "Travado"}
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
