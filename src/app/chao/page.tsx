import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { RealtimePainel } from "@/app/_components/realtime-painel";
import { ESTADOS_OS, type EstadoOS, rotuloEstado } from "@/domain/os/estado";
import { sessaoAtual } from "@/infra/auth/sessao";
import { type CardPainel, listarChaoPorEstacao, listarPainel } from "@/infra/composition/os";
import { RESPONSABILIDADE_ROTULO } from "@/ui/components/travamento-selo";
import { BumpChao } from "./bump-chao";

type CardChao = CardPainel;

export const metadata: Metadata = {
  title: "Chão — Igni",
};

const ESTADOS_VALIDOS = new Set<string>(ESTADOS_OS);

/**
 * TELA DE CHÃO (adoção): quiosque para o tablet da estação. Cards ENORMES, 1 TOQUE pra avançar, zero
 * digitação. Agrupa por ETAPA (estado lógico) ou, com ?por=estacao, por ESTAÇÃO FÍSICA (o posto no
 * chão, I7). Filtra por etapa com ?etapa=execucao (a estação vê só o que é dela). Sem etapa = tudo.
 */
export default async function ChaoPage({
  searchParams,
}: {
  searchParams: Promise<{ etapa?: string; por?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }

  const { etapa: filtroBruto, por } = await searchParams;
  const porEstacao = por === "estacao";

  // Grupos a renderizar: por estação física, ou por etapa (com filtro opcional).
  let visiveis: { chave: string; rotulo: string; mostrarTitulo: boolean; cards: CardChao[] }[];
  let filtro: EstadoOS | null = null;
  // Chips de etapa (só no modo etapa): contagem por etapa, vinda da mesma leitura.
  let etapasParaChips: { estado: EstadoOS; rotulo: string; cards: CardChao[] }[] = [];
  if (porEstacao) {
    const { grupos } = await listarChaoPorEstacao(sessao);
    visiveis = grupos.map((g) => ({
      chave: g.estacaoId ?? "sem-estacao",
      rotulo: g.rotulo,
      mostrarTitulo: true,
      cards: g.cards,
    }));
  } else {
    const { etapas } = await listarPainel(sessao);
    etapasParaChips = etapas;
    filtro = filtroBruto && ESTADOS_VALIDOS.has(filtroBruto) ? (filtroBruto as EstadoOS) : null;
    visiveis = (filtro ? etapas.filter((e) => e.estado === filtro) : etapas).map((e) => ({
      chave: e.estado,
      rotulo: e.rotulo,
      mostrarTitulo: filtro === null,
      cards: e.cards,
    }));
  }

  return (
    <div className="flex min-h-dvh flex-col bg-grafite-900">
      <header className="flex items-center justify-between gap-4 border-b border-grafite-700 px-5 py-4">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-2xl font-bold tracking-tight text-ambar-500">IGNI</span>
          <span className="font-mono text-sm uppercase tracking-widest text-aco-300">
            Chão{porEstacao ? " · por estação" : filtro ? ` · ${rotuloEstado(filtro)}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <RealtimePainel tenantId={sessao.tenantId} />
          <Link href="/" className="font-mono text-xs text-aco-400 hover:text-aco-100">
            voltar ao painel
          </Link>
        </div>
      </header>

      {/* Modo de agrupamento + filtros (toque grande) — a estação escolhe o que vê */}
      <nav className="flex flex-wrap items-center gap-2 border-b border-grafite-700 px-5 py-3" aria-label="Agrupar e filtrar">
        <FiltroChip href="/chao" ativo={!porEstacao && filtro === null} rotulo="Por etapa" />
        <FiltroChip href="/chao?por=estacao" ativo={porEstacao} rotulo="Por estação" />
        {!porEstacao ? (
          <>
            <span className="mx-1 h-5 w-px bg-grafite-700" aria-hidden />
            {etapasParaChips.map((e) => (
              <FiltroChip
                key={e.estado}
                href={`/chao?etapa=${e.estado}`}
                ativo={filtro === e.estado}
                rotulo={`${e.rotulo} (${e.cards.length})`}
              />
            ))}
          </>
        ) : null}
      </nav>

      <main className="flex-1 px-5 py-6">
        {visiveis.length === 0 ? (
          <div className="grid h-full place-items-center">
            <p className="font-display text-2xl text-aco-300">
              {porEstacao ? "Nenhuma OS nas estações agora." : "Nada nesta etapa agora."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {visiveis.map((grupo) => (
              <section key={grupo.chave} aria-label={grupo.rotulo}>
                {grupo.mostrarTitulo ? (
                  <h2 className="mb-3 font-display text-xl text-aco-300">{grupo.rotulo}</h2>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {grupo.cards.map((card) => (
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
