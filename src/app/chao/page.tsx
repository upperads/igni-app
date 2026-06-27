import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { RealtimePainel } from "@/app/_components/realtime-painel";
import { ESTADOS_OS, type EstadoOS, rotuloEstado } from "@/domain/os/estado";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarPainel } from "@/infra/composition/os";
import { RESPONSABILIDADE_ROTULO } from "@/ui/components/travamento-selo";
import { BumpChao } from "./bump-chao";

export const metadata: Metadata = {
  title: "Chão — Igni",
};

const ESTADOS_VALIDOS = new Set<string>(ESTADOS_OS);

/**
 * TELA DE CHÃO (adoção): quiosque para o tablet da estação. Cards ENORMES, 1 TOQUE pra avançar, zero
 * digitação. Filtra por etapa com ?etapa=execucao (a estação vê só o que é dela). Sem etapa = tudo.
 */
export default async function ChaoPage({
  searchParams,
}: {
  searchParams: Promise<{ etapa?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }

  const { etapas } = await listarPainel(sessao);
  const { etapa: filtroBruto } = await searchParams;
  const filtro = filtroBruto && ESTADOS_VALIDOS.has(filtroBruto) ? (filtroBruto as EstadoOS) : null;
  const visiveis = filtro ? etapas.filter((e) => e.estado === filtro) : etapas;

  return (
    <div className="flex min-h-dvh flex-col bg-grafite-900">
      <header className="flex items-center justify-between gap-4 border-b border-grafite-700 px-5 py-4">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-2xl font-bold tracking-tight text-ambar-500">IGNI</span>
          <span className="font-mono text-sm uppercase tracking-widest text-aco-300">
            Chão{filtro ? ` · ${rotuloEstado(filtro)}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <RealtimePainel tenantId={sessao.tenantId} />
          <Link href="/" className="font-mono text-xs text-aco-400 hover:text-aco-100">
            sair
          </Link>
        </div>
      </header>

      {/* Filtro por etapa (toque grande) — a estação escolhe o que vê */}
      <nav className="flex flex-wrap gap-2 border-b border-grafite-700 px-5 py-3" aria-label="Etapas">
        <FiltroChip href="/chao" ativo={filtro === null} rotulo="Tudo" />
        {etapas.map((e) => (
          <FiltroChip
            key={e.estado}
            href={`/chao?etapa=${e.estado}`}
            ativo={filtro === e.estado}
            rotulo={`${e.rotulo} (${e.cards.length})`}
          />
        ))}
      </nav>

      <main className="flex-1 px-5 py-6">
        {visiveis.length === 0 ? (
          <div className="grid h-full place-items-center">
            <p className="font-display text-2xl text-aco-300">Nada nesta etapa agora.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {visiveis.map((etapa) => (
              <section key={etapa.estado} aria-label={`Etapa ${etapa.rotulo}`}>
                {filtro === null ? (
                  <h2 className="mb-3 font-display text-xl text-aco-300">{etapa.rotulo}</h2>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {etapa.cards.map((card) => (
                    <article
                      key={card.id}
                      className="flex flex-col gap-3 rounded-xl border border-grafite-700 bg-grafite-800 p-5"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-sm text-aco-400">{card.codigo}</span>
                        <span className="font-mono text-sm tabular-nums text-aco-300">
                          {card.prazoLabel}
                        </span>
                      </div>
                      <p className="font-display text-2xl leading-tight text-aco-100">
                        {card.equipamento}
                      </p>
                      {card.travado ? (
                        <p className="font-mono text-sm uppercase tracking-wide text-ambar-500">
                          ⏸ {card.travamentoResponsabilidade
                            ? RESPONSABILIDADE_ROTULO[card.travamentoResponsabilidade]
                            : "Travado"}
                        </p>
                      ) : null}
                      <div className="mt-auto pt-1">
                        {card.proximoBump ? (
                          <BumpChao osId={card.id} proximo={card.proximoBump} />
                        ) : (
                          <Link
                            href={`/os/${card.id}`}
                            className="grid min-h-20 w-full place-items-center rounded-lg border border-grafite-600 font-display text-lg text-aco-300 hover:text-aco-100"
                          >
                            Precisa de decisão — abrir
                          </Link>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FiltroChip({ href, ativo, rotulo }: { href: string; ativo: boolean; rotulo: string }) {
  return (
    <Link
      href={href}
      className={
        ativo
          ? "rounded-full bg-ambar-500 px-4 py-2 font-mono text-sm text-grafite-900"
          : "rounded-full border border-grafite-600 px-4 py-2 font-mono text-sm text-aco-300 hover:text-aco-100"
      }
    >
      {rotulo}
    </Link>
  );
}
