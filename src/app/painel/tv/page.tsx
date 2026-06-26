import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { RealtimePainel } from "@/app/_components/realtime-painel";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarPainel } from "@/infra/composition/os";
import { OsCard } from "@/ui/components/os-card";
import { Relogio } from "@/ui/components/relogio";
import { RiskRail } from "@/ui/components/risk-rail";

export const metadata: Metadata = {
  title: "Painel — Igni (modo TV)",
};

/** Modo TV (US-09): board read-only, tela cheia, zero navegação. Atualiza ao vivo (Realtime, ADR-010). */
export default async function PainelTvPage() {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }

  const { kpis, etapas } = await listarPainel(sessao);
  const alarme = kpis.paradaCritica > 0 || kpis.atraso.total > 0;

  return (
    <div className="flex min-h-dvh flex-col bg-grafite-900">
      <RiskRail alarme={alarme} />

      <header className="flex items-center justify-between gap-4 border-b border-grafite-700 px-6 py-4">
        <div className="flex items-baseline gap-4">
          <span className="font-display text-2xl font-bold tracking-tight text-ambar-500">IGNI</span>
          <span className="hidden font-mono text-sm uppercase tracking-widest text-aco-300 sm:inline">
            Painel da oficina
          </span>
        </div>
        <div className="flex items-center gap-5">
          <span className="font-mono text-sm text-aco-300">
            {kpis.naCasa} na casa · {kpis.paradaCritica} crítica · {kpis.travadas} travada ·{" "}
            <span className={alarme && kpis.atraso.total > 0 ? "text-ambar-500" : ""}>
              {kpis.atraso.total} atraso
            </span>
          </span>
          <RealtimePainel tenantId={sessao.tenantId} />
          <Relogio className="font-mono text-2xl tabular-nums text-aco-100" />
          <Link href="/" className="font-mono text-xs text-aco-400 hover:text-aco-100">
            sair
          </Link>
        </div>
      </header>

      {/* Responsabilização na PAREDE: de quem é a bola do atraso, legível de longe (o diferencial). */}
      {kpis.atraso.total > 0 ? (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-ambar-600/40 bg-grafite-850 px-6 py-3">
          <span className="font-mono text-sm uppercase tracking-[0.2em] text-aco-400">
            Atraso · de quem é a bola
          </span>
          <div className="flex items-center gap-7 font-mono text-2xl tabular-nums">
            <span className="text-aco-200">
              {kpis.atraso.nossa} <span className="text-base text-aco-400">oficina</span>
            </span>
            <span className="text-ambar-500">
              {kpis.atraso.cliente} <span className="text-base text-aco-400">cliente</span>
            </span>
            <span className="text-sinal-laranja">
              {kpis.atraso.peca} <span className="text-base text-aco-400">peça</span>
            </span>
          </div>
        </div>
      ) : null}

      <main className="flex-1 px-6 py-6">
        {etapas.length === 0 ? (
          <div className="grid h-full place-items-center">
            <p className="font-display text-2xl text-aco-300">Nenhum serviço na oficina agora.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {etapas.map((etapa) => (
              <section key={etapa.estado} aria-label={`Etapa ${etapa.rotulo}`}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="font-display text-2xl text-aco-100">{etapa.rotulo}</h2>
                  <span className="font-mono text-sm text-aco-400">{etapa.cards.length}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {etapa.cards.map((card) => (
                    <OsCard
                      key={card.id}
                      codigo={card.codigo}
                      equipamento={card.equipamento}
                      responsavel={card.responsavel}
                      prazo={card.prazoLabel}
                      sinal={card.sinal}
                      travado={card.travado}
                      responsabilidade={card.travamentoResponsabilidade}
                    />
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
