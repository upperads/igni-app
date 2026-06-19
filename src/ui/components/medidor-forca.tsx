import type { ForcaSenha } from "@/domain/auth/forca-senha";
import { cn } from "@/ui/cn";

/** Barra de força de senha (4 segmentos) + rótulo. Compartilhada pelos formulários de senha. */
export function MedidorForca({ forca }: { forca: ForcaSenha }) {
  const cor =
    forca.nivel <= 1 ? "bg-sinal-vermelho" : forca.nivel === 2 ? "bg-sinal-amarelo" : "bg-sinal-verde";
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded", i < forca.nivel ? cor : "bg-grafite-700")} />
        ))}
      </div>
      <span className="font-mono text-[11px] text-aco-400">{forca.rotulo}</span>
    </div>
  );
}
