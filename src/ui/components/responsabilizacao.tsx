import { cn } from "@/ui/cn";

/** De quem é a bola (o pilar do produto). Visão interna: oficina / cliente / peça. */
export type Bola = "oficina" | "cliente" | "peca";

const ROTULO: Record<Bola, string> = {
  oficina: "Oficina",
  cliente: "Cliente",
  peca: "Peça",
};

/**
 * Bloco HERÓI da responsabilização. Âmbar quando a bola NÃO está com a oficina (pede ação/atenção);
 * neutro quando está com a gente (transparência, não vergonha). CDC-safe: comunica estado, não culpa.
 */
export function Responsabilizacao({
  bola,
  detalhe,
  className,
}: {
  bola: Bola;
  detalhe: string;
  className?: string;
}) {
  const alarme = bola !== "oficina";
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        alarme ? "border-ambar-600/45 bg-ambar-500/10" : "border-grafite-700 bg-grafite-800",
        className,
      )}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-aco-400">
        De quem é a bola
      </p>
      <p
        className={cn(
          "mt-1 font-display text-2xl leading-none",
          alarme ? "text-ambar-500" : "text-aco-100",
        )}
      >
        {ROTULO[bola]}
      </p>
      <p className="mt-2 font-body text-sm text-aco-300">{detalhe}</p>
    </div>
  );
}
