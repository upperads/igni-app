import { ESTADOS_OS, type EstadoOS, rotuloEstado } from "@/domain/os/estado";
import { cn } from "@/ui/cn";
import { SINAL, type Sinal } from "@/ui/sinal";

/** A linha de produção como escala de instrumento (todos os estados, na ordem). */
const ESCALA = ESTADOS_OS;

/**
 * MEDIDOR DE ESTADO — a assinatura da linguagem "Instrumento" (substitui o side-stripe). Mostra,
 * numa coisa só, ONDE a OS está na linha de produção (escala graduada, posição atual no sinal da
 * triagem) e o CRONÔMETRO do prazo. Lê-se de relance, na TV e na mão.
 */
export function MedidorEstado({
  estado,
  sinal,
  prazoLabel,
}: {
  estado: EstadoOS;
  sinal: Sinal;
  prazoLabel: string;
}) {
  const info = SINAL[sinal];
  const atual = ESCALA.indexOf(estado);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-aco-400">
          Estágio · {atual + 1}/{ESCALA.length}
        </span>
        <span className={cn("font-mono text-sm tabular-nums", info.texto)}>{prazoLabel}</span>
      </div>

      <p className="mt-1.5 font-display text-4xl leading-none tracking-tight text-aco-100">
        {rotuloEstado(estado)}
      </p>

      <div
        className="mt-4 flex items-end gap-1"
        role="img"
        aria-label={`Etapa ${atual + 1} de ${ESCALA.length}: ${rotuloEstado(estado)}`}
      >
        {ESCALA.map((e, i) => {
          const passou = i < atual;
          const agora = i === atual;
          return (
            <span
              key={e}
              className={cn(
                "flex-1 rounded-[2px] transition-[height] duration-200",
                agora ? "h-7" : passou ? "h-3" : "h-2",
              )}
              style={{
                background: agora
                  ? info.cor
                  : passou
                    ? "var(--color-aco-400)"
                    : "var(--color-grafite-700)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
