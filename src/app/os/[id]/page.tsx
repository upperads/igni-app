import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { proximosEstados, quatroPerguntas, rotuloEstado } from "@/domain/os/estado";
import { sessaoAtual } from "@/infra/auth/sessao";
import { detalheOs } from "@/infra/composition/os";
import { AppShell } from "@/ui/components/app-shell";
import { EstadoBadge } from "@/ui/components/estado-badge";
import { PrioridadeBadge } from "@/ui/components/prioridade-badge";
import { RESPONSABILIDADE_ROTULO, TravamentoSelo } from "@/ui/components/travamento-selo";
import { AcoesOs } from "./acoes";
import { AcoesTriagem } from "./triagem";

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const TIPO_CLIENTE_ROTULO: Record<string, string> = {
  frota: "Frota",
  produtor: "Produtor",
  avulso: "Avulso",
};

export default async function DetalheOsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }

  const os = await detalheOs(sessao, id);
  if (!os) {
    notFound();
  }

  const perguntas = quatroPerguntas(os.estado);
  const proximos = proximosEstados(os.estado);

  const cartoes: Array<{ rotulo: string; valor: string }> = [
    { rotulo: "Onde está", valor: perguntas.onde },
    { rotulo: "Por quê", valor: perguntas.porque },
    { rotulo: "O que falta", valor: perguntas.oQueFalta },
    { rotulo: "Pra onde vai", valor: perguntas.praOnde },
  ];

  return (
    <AppShell>
      <div className="mb-2">
        <Link href="/os" className="font-mono text-xs text-aco-400 hover:text-ambar-500">
          ← Ordens de serviço
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-aco-100">
            {os.equipamento.tipo}
          </h1>
          <p className="mt-1 font-body text-sm text-aco-400">
            {os.cliente.nome} · {TIPO_CLIENTE_ROTULO[os.cliente.tipo] ?? os.cliente.tipo}
            {os.equipamento.placa ? ` · ${os.equipamento.placa}` : ""}
          </p>
          {os.travado && os.travamentoMotivo ? (
            <p className="mt-1.5 font-body text-sm text-ambar-500">
              Travado: {os.travamentoMotivo}
              {os.travamentoResponsabilidade
                ? ` (${RESPONSABILIDADE_ROTULO[os.travamentoResponsabilidade]})`
                : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EstadoBadge estado={os.estado} />
          <PrioridadeBadge prioridade={os.prioridade} />
          {os.travado ? <TravamentoSelo responsabilidade={os.travamentoResponsabilidade} /> : null}
        </div>
      </div>

      <section aria-label="As quatro perguntas" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="rounded-md border border-grafite-700 bg-grafite-800 p-4">
            <p className="font-mono text-xs uppercase tracking-wide text-aco-400">{c.rotulo}</p>
            <p className="mt-1.5 font-body text-sm text-aco-100">{c.valor}</p>
          </div>
        ))}
      </section>

      <section className="mt-8" aria-label="Próximo passo">
        <h2 className="mb-3 font-display text-xl text-aco-100">Próximo passo</h2>
        <AcoesOs
          osId={os.id}
          proximos={proximos}
          podeRecall={os.eventos.length > 0 && os.eventos[0]!.deEstado !== null}
        />
      </section>

      <section className="mt-8" aria-label="Triagem">
        <h2 className="mb-3 font-display text-xl text-aco-100">Triagem</h2>
        <AcoesTriagem
          osId={os.id}
          prioridade={os.prioridade}
          temOverride={os.prioridadeOverride !== null}
          travado={os.travado}
        />
      </section>

      <section className="mt-8" aria-label="Linha do tempo">
        <h2 className="mb-3 font-display text-xl text-aco-100">Linha do tempo</h2>
        <ol className="relative flex flex-col gap-4 border-l border-grafite-700 pl-5">
          {os.eventos.map((ev, i) => (
            <li key={`${ev.em.toISOString()}-${i}`} className="relative">
              <span
                className="absolute -left-[1.4rem] top-1.5 size-2 rounded-full bg-ambar-500"
                aria-hidden
              />
              <p className="font-body text-sm text-aco-100">
                {ev.deEstado
                  ? `${rotuloEstado(ev.deEstado)} → ${rotuloEstado(ev.paraEstado)}`
                  : `Aberta (${rotuloEstado(ev.paraEstado)})`}
              </p>
              <p className="mt-0.5 font-mono text-xs text-aco-400">{DATA_HORA.format(ev.em)}</p>
              {ev.motivo ? (
                <p className="mt-0.5 font-body text-xs text-aco-400">{ev.motivo}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}
