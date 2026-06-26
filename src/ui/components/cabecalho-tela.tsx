import type { ReactNode } from "react";

/** Cabeçalho de tela na linguagem Instrumento: etiqueta mono + título placa + ação opcional. */
export function CabecalhoTela({
  etiqueta,
  titulo,
  sub,
  acao,
}: {
  etiqueta: string;
  titulo: string;
  sub?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-aco-400">{etiqueta}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-aco-100">{titulo}</h1>
        {sub ? <p className="mt-1 max-w-prose font-body text-sm text-aco-400">{sub}</p> : null}
      </div>
      {acao}
    </div>
  );
}
