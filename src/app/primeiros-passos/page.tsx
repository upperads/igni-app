import type { Metadata } from "next";
import { AppShell } from "@/ui/components/app-shell";
import { FECHAMENTO, FECHAMENTO_TITULO, INTRO, INTRO_TITULO, PASSOS } from "./conteudo";

export const metadata: Metadata = {
  title: "Primeiros passos — Igni",
};

export default function PrimeirosPassosPage() {
  return (
    <AppShell>
      <article className="mx-auto max-w-2xl">
        <header>
          <p className="font-mono text-xs uppercase tracking-widest text-ambar-500">Guia</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-aco-100">
            Primeiros passos no Igni
          </h1>
        </header>

        <section className="mt-8" aria-labelledby="intro">
          <h2 id="intro" className="font-display text-xl text-aco-100">
            {INTRO_TITULO}
          </h2>
          <div className="mt-3 space-y-4">
            {INTRO.map((p) => (
              <p key={p} className="font-body text-[15px] leading-relaxed text-aco-200">
                {p}
              </p>
            ))}
          </div>
        </section>

        <ol className="mt-12 space-y-10">
          {PASSOS.map((passo) => (
            <li key={passo.numero} className="flex gap-4 sm:gap-5">
              <div className="flex flex-col items-center">
                <span className="grid size-10 shrink-0 place-items-center rounded-md border border-grafite-700 bg-grafite-800 font-display text-xl text-ambar-500">
                  {passo.numero}
                </span>
                <span className="mt-2 w-px flex-1 bg-grafite-700" aria-hidden />
              </div>
              <div className="pb-1">
                <h2 className="font-display text-xl leading-tight text-aco-100">{passo.titulo}</h2>
                <div className="mt-2 space-y-3">
                  {passo.paragrafos.map((p) => (
                    <p key={p} className="font-body text-[15px] leading-relaxed text-aco-200">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-12 border-t border-grafite-700 pt-8" aria-labelledby="fechamento">
          <h2 id="fechamento" className="font-display text-xl text-aco-100">
            {FECHAMENTO_TITULO}
          </h2>
          <div className="mt-3 space-y-4">
            {FECHAMENTO.map((p) => (
              <p key={p} className="font-body text-[15px] leading-relaxed text-aco-200">
                {p}
              </p>
            ))}
          </div>
        </section>
      </article>
    </AppShell>
  );
}
