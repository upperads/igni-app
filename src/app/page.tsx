import { AppShell } from "@/ui/components/app-shell";
import { Button } from "@/ui/components/button";
import { KpiStat } from "@/ui/components/kpi-stat";
import { OsCard } from "@/ui/components/os-card";
import { StatusPill } from "@/ui/components/status-pill";
import type { Sinal } from "@/ui/sinal";

const FILA: Array<{
  codigo: string;
  equipamento: string;
  responsavel: string | null;
  prazo: string;
  sinal: Sinal;
  travado?: boolean;
}> = [
  { codigo: "OS-2041", equipamento: "Scania DC13", responsavel: "Marcão", prazo: "03d", sinal: "critico" },
  { codigo: "OS-2038", equipamento: "JD PowerTech", responsavel: "Cleiton", prazo: "02d", sinal: "atraso", travado: true },
  { codigo: "OS-2050", equipamento: "MF Perkins", responsavel: null, prazo: "06d", sinal: "emdia" },
  { codigo: "OS-2044", equipamento: "Cummins ISX", responsavel: "Tide", prazo: "04d", sinal: "atencao" },
  { codigo: "OS-2052", equipamento: "Volvo D13", responsavel: "Bia", prazo: "—", sinal: "aguardando" },
];

const LEGENDA: Sinal[] = ["critico", "atraso", "atencao", "emdia", "aguardando"];

export default function Home() {
  return (
    <AppShell alarme setor="Setor: Cabeçote">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-aco-100">Painel geral</h1>
          <p className="mt-1 max-w-prose font-body text-sm text-aco-400">
            A oficina inteira de relance, em tempo real. O atraso é a manchete.
          </p>
        </div>
        <Button variante="fantasma">Modo TV</Button>
      </div>

      <section aria-label="Indicadores de gestão" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiStat rotulo="Na casa" valor="24" />
        <KpiStat rotulo="Parada crítica" valor="3" />
        <KpiStat rotulo="Travadas" valor="5" />
        <KpiStat rotulo="Atraso" valor="2" manchete alarme />
      </section>

      <section className="mt-8" aria-label="Fila do setor Cabeçote">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl text-aco-100">Cabeçote</h2>
          <span className="font-mono text-xs text-aco-400">fila 3 · exec 2 · travada 1</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FILA.map((os) => (
            <OsCard key={os.codigo} {...os} />
          ))}
        </div>
      </section>

      <section className="mt-8" aria-label="Legenda da triagem">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-aco-400">Triagem</h2>
        <div className="flex flex-wrap gap-2">
          {LEGENDA.map((s) => (
            <StatusPill key={s} sinal={s} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
