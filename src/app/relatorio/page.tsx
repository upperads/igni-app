import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { pode } from "@/domain/auth/rbac";
import { sessaoAtual } from "@/infra/auth/sessao";
import { relatorioDeGestao } from "@/infra/composition/os";
import { AppShell } from "@/ui/components/app-shell";
import { BarraResponsabilizacao } from "@/ui/components/barra-responsabilizacao";
import { CabecalhoTela } from "@/ui/components/cabecalho-tela";
import { KpiStat } from "@/ui/components/kpi-stat";

export const metadata: Metadata = {
  title: "Relatório — Igni",
};

const JANELAS = [
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
] as const;

export default async function RelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }
  // Relatório de gestão é coisa de gestão; produção não precisa.
  if (!pode(sessao.permissoes, "config:editar") && !pode(sessao.permissoes, "equipe:gerir")) {
    redirect("/");
  }

  const { dias: diasBruto } = await searchParams;
  const dias = diasBruto === "90" ? 90 : 30;
  const rel = await relatorioDeGestao(sessao, dias);
  const semDados = rel.adocao.total === 0 && rel.culpa.total === 0;

  return (
    <AppShell>
      <CabecalhoTela
        etiqueta="Gestão"
        titulo="Relatório"
        sub="O que o sistema prova, preto no branco: quanto o chão usou e de quem foi o atraso. Para a sua reunião, não para a discussão no balcão."
        acao={
          <div className="flex gap-2">
            {JANELAS.map((j) => (
              <Link
                key={j.dias}
                href={`/relatorio?dias=${j.dias}`}
                className={
                  dias === j.dias
                    ? "rounded-full bg-ambar-500 px-4 py-2 font-mono text-sm text-grafite-900"
                    : "rounded-full border border-grafite-600 px-4 py-2 font-mono text-sm text-aco-300 hover:text-aco-100"
                }
              >
                {j.rotulo}
              </Link>
            ))}
          </div>
        }
      />

      {semDados ? (
        <div className="rounded-lg border border-dashed border-grafite-600 bg-grafite-850 px-6 py-12 text-center">
          <p className="font-display text-lg text-aco-100">Sem movimento no período.</p>
          <p className="mx-auto mt-1 max-w-prose font-body text-sm text-aco-400">
            Conforme as OS andarem, este relatório se preenche sozinho, com os números do chão e do atraso.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Dois números-herói: adoção do chão + atraso fora da alçada */}
          <section aria-label="Indicadores do período" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <KpiStat
              rotulo="Avanços feitos pelo chão"
              valor={`${rel.adocao.pctChao}%`}
              manchete
              alarme={rel.adocao.pctChao >= 50}
            />
            <KpiStat
              rotulo="Atraso fora da sua alçada"
              valor={`${rel.pctForaDaAlcada}%`}
              manchete
              alarme={rel.pctForaDaAlcada >= 50}
            />
          </section>

          <p className="font-body text-sm text-aco-300">
            Nos últimos {dias} dias, <span className="text-aco-100">{rel.adocao.chao}</span> de{" "}
            <span className="text-aco-100">{rel.adocao.total}</span> avanços de etapa vieram do chão
            (o resto, do escritório). Das <span className="text-aco-100">{rel.culpa.total}</span> esperas
            do período, <span className="text-aco-100">{rel.pctForaDaAlcada}%</span> não dependeram da
            oficina.
          </p>

          <BarraResponsabilizacao
            titulo={`Últimos ${dias} dias · de quem foi a bola`}
            sufixo="esperas"
            dist={rel.culpa}
          />

          <p className="font-mono text-xs text-aco-400">
            Lido da linha do tempo das OS. Sem digitar nada a mais: cada toque no chão já gera este número.
          </p>
        </div>
      )}
    </AppShell>
  );
}
