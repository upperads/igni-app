import Link from "next/link";
import type { EstadoImplantacao } from "@/infra/composition/config";

interface Passo {
  feito: boolean;
  titulo: string;
  texto: string;
  href: string;
  cta: string;
}

/**
 * Guia de implantação no topo do painel (I3/I4). Aparece enquanto a oficina é nova — substitui o
 * "painel vazio" por uma jornada de três passos: convidar a equipe, conferir as estações, abrir a
 * primeira OS. Some sozinho quando a oficina começa a rodar (tem equipe e tem OS).
 */
export function ComecePorAqui({ estado }: { estado: EstadoImplantacao }) {
  const passos: Passo[] = [
    {
      feito: estado.temEquipe,
      titulo: "Convide a sua equipe",
      texto:
        "A recepção e o pessoal do chão. É com eles usando que o Igni vira rotina — e cada toque do chão vira o seu relatório.",
      href: "/config/equipe",
      cta: "Convidar equipe",
    },
    {
      feito: estado.temEstacoes,
      titulo: "Confira as estações",
      texto:
        "Os postos por onde o trabalho passa já vieram do seu ramo. Dê uma olhada e ajuste para a realidade da sua oficina.",
      href: "/config/estacoes",
      cta: "Ver estações",
    },
    {
      feito: estado.temOs,
      titulo: "Abra a primeira OS",
      texto:
        "Um equipamento de verdade que entrou hoje. Ele aparece no painel, no chão e na TV — e o ciclo começa.",
      href: "/os/nova",
      cta: "Abrir OS",
    },
  ];

  const restantes = passos.filter((p) => !p.feito).length;

  return (
    <section
      aria-label="Comece por aqui"
      className="mb-6 rounded-lg border border-ambar-600/40 bg-grafite-800 p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ambar-500">
            Implantação
          </p>
          <h2 className="mt-1 font-display text-xl text-aco-100">Comece por aqui</h2>
        </div>
        <p className="font-mono text-xs text-aco-400">
          {restantes === 0 ? "tudo pronto" : `${restantes} de 3 a fazer`}
        </p>
      </div>

      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {passos.map((p, i) => (
          <li
            key={p.href}
            className={
              p.feito
                ? "flex flex-col rounded-lg border border-grafite-700 bg-grafite-850/60 p-4 opacity-75"
                : "flex flex-col rounded-lg border border-grafite-600 bg-grafite-850 p-4"
            }
          >
            <div className="flex items-center gap-2">
              <span
                className={
                  p.feito
                    ? "grid size-6 shrink-0 place-items-center rounded-full bg-sinal-verde font-mono text-xs text-grafite-900"
                    : "grid size-6 shrink-0 place-items-center rounded-full border border-aco-500 font-mono text-xs text-aco-400"
                }
                aria-hidden
              >
                {p.feito ? "✓" : i + 1}
              </span>
              <h3 className="font-display text-base text-aco-100">{p.titulo}</h3>
            </div>
            <p className="mt-2 flex-1 font-body text-sm text-aco-400">{p.texto}</p>
            {p.feito ? (
              <span className="mt-3 font-mono text-xs text-sinal-verde">feito</span>
            ) : (
              <Link
                href={p.href}
                className="mt-3 inline-flex font-mono text-sm text-ambar-500 hover:underline"
              >
                {p.cta} →
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
