import Link from "next/link";
import { redirect } from "next/navigation";
import { CardPainelBump } from "@/app/_components/card-painel-bump";
import { RealtimePainel } from "@/app/_components/realtime-painel";
import { sessaoAtual } from "@/infra/auth/sessao";
import { historicoResponsabilidade, listarPainel } from "@/infra/composition/os";
import { AppShell } from "@/ui/components/app-shell";
import { BarraResponsabilizacao } from "@/ui/components/barra-responsabilizacao";
import { Button } from "@/ui/components/button";
import { KpiStat } from "@/ui/components/kpi-stat";

export default async function Home() {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }

  const [{ kpis, etapas }, historico] = await Promise.all([
    listarPainel(sessao),
    historicoResponsabilidade(sessao, 30),
  ]);
  const alarme = kpis.paradaCritica > 0 || kpis.atraso.total > 0;

  return (
    <AppShell alarme={alarme}>
      <Link
        href="/primeiros-passos"
        className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-ambar-600/40 bg-grafite-800 px-5 py-4 transition-colors hover:border-ambar-600/70"
      >
        <div>
          <p className="font-display text-lg text-aco-100">Primeiros passos</p>
          <p className="mt-0.5 font-body text-sm text-aco-400">
            Novo por aqui? Veja como começar a usar o Igni, com calma.
          </p>
        </div>
        <span className="shrink-0 font-mono text-sm text-ambar-500" aria-hidden>
          Abrir →
        </span>
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-aco-100">Painel geral</h1>
          <p className="mt-1 max-w-prose font-body text-sm text-aco-400">
            A oficina inteira de relance, em tempo real. O atraso é a manchete.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <RealtimePainel tenantId={sessao.tenantId} />
          <Link href="/painel/tv">
            <Button variante="fantasma">Modo TV</Button>
          </Link>
        </div>
      </div>

      <section aria-label="Indicadores de gestão" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiStat rotulo="Na casa" valor={String(kpis.naCasa)} />
        <KpiStat rotulo="Parada crítica" valor={String(kpis.paradaCritica)} alarme={kpis.paradaCritica > 0} />
        <KpiStat rotulo="Travadas" valor={String(kpis.travadas)} />
        <KpiStat rotulo="Atraso" valor={String(kpis.atraso.total)} manchete alarme={kpis.atraso.total > 0} />
      </section>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <BarraResponsabilizacao
          titulo="Atraso · de quem é a bola"
          sufixo="OS"
          dist={kpis.atraso}
        />
        <BarraResponsabilizacao
          titulo="Últimos 30 dias · de quem foi a bola"
          sufixo="esperas"
          dist={historico}
        />
      </div>

      {etapas.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-grafite-600 bg-grafite-850 px-6 py-12 text-center">
          <p className="font-display text-lg text-aco-100">Nenhuma OS ativa na casa.</p>
          <p className="mx-auto mt-1 max-w-prose font-body text-sm text-aco-400">
            Quando um equipamento entrar, abra a OS e ela aparece aqui, na etapa certa.
          </p>
          <Link href="/os/nova" className="mt-5 inline-flex font-mono text-sm text-ambar-500 hover:underline">
            Abrir uma OS →
          </Link>
        </div>
      ) : (
        etapas.map((etapa) => (
          <section key={etapa.estado} className="mt-8" aria-label={`Etapa ${etapa.rotulo}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-xl text-aco-100">{etapa.rotulo}</h2>
              <span className="font-mono text-xs text-aco-400">{etapa.cards.length} OS</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {etapa.cards.map((card) => (
                <CardPainelBump
                  key={card.id}
                  id={card.id}
                  codigo={card.codigo}
                  equipamento={card.equipamento}
                  responsavel={card.responsavel}
                  prazoLabel={card.prazoLabel}
                  sinal={card.sinal}
                  travado={card.travado}
                  travamentoResponsabilidade={card.travamentoResponsabilidade}
                  proximoBump={card.proximoBump}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </AppShell>
  );
}
