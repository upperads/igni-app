import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { pode } from "@/domain/auth/rbac";
import { proximosEstados, quatroPerguntas, rotuloEstado } from "@/domain/os/estado";
import { calcularBola, sinalDaOs } from "@/domain/os/painel";
import { diasRestantesAte } from "@/domain/os/triagem";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarEstacoesNoTenant } from "@/infra/composition/config";
import { contaDaOsNoTenant } from "@/infra/composition/conta";
import { detalheOs, orcamentoDaOs } from "@/infra/composition/os";
import { listarServicosNoTenant } from "@/infra/composition/servico";
import { AppShell } from "@/ui/components/app-shell";
import { dataHora } from "@/ui/format";
import { MedidorEstado } from "@/ui/components/medidor-estado";
import { PrioridadeBadge } from "@/ui/components/prioridade-badge";
import { Responsabilizacao } from "@/ui/components/responsabilizacao";
import { AcoesOs } from "./acoes";
import { AvisarWhatsapp } from "./avisar-whatsapp";
import { EstacaoFisica } from "./estacao-fisica";
import { Financeiro } from "./financeiro";
import { Orcamento } from "./orcamento";
import { AcoesTriagem } from "./triagem";

const TIPO_CLIENTE_ROTULO: Record<string, string> = {
  frota: "Frota",
  produtor: "Produtor",
  avulso: "Avulso",
};

function prazoLabel(dias: number | null): string {
  if (dias === null) return "sem prazo";
  if (dias < 0) return `atrasado ${-dias}d`;
  if (dias === 0) return "vence hoje";
  return `faltam ${dias}d`;
}

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

  const [orcamento, estacoes, servicos, conta] = await Promise.all([
    orcamentoDaOs(sessao, id),
    listarEstacoesNoTenant(sessao),
    listarServicosNoTenant(sessao),
    contaDaOsNoTenant(sessao, id),
  ]);
  const podeEditarOrcamento = pode(sessao.permissoes, "orcamento:editar");
  const podeEditarOs = pode(sessao.permissoes, "os:editar");
  const podeVerFinanceiro = pode(sessao.permissoes, "dinheiro:ver");
  const podeCancelarCobranca = pode(sessao.permissoes, "financeiro:gerir");
  const proximos = proximosEstados(os.estado);
  const perguntas = quatroPerguntas(os.estado);
  const diasRestantes = diasRestantesAte(os.prazoPrometido, new Date());
  const sinal = sinalDaOs({ prioridade: os.prioridade, travado: os.travado, diasRestantes });
  const { bola, detalhe } = calcularBola({
    estado: os.estado,
    orcamentoAprovado: orcamento?.status === "aprovado",
    travado: os.travado,
    travamentoResponsabilidade: os.travamentoResponsabilidade,
    travamentoMotivo: os.travamentoMotivo,
  });

  const legenda: Array<{ k: string; v: string }> = [
    { k: "Onde está", v: perguntas.onde },
    { k: "Por quê", v: perguntas.porque },
    { k: "O que falta", v: perguntas.oQueFalta },
    { k: "Pra onde vai", v: perguntas.praOnde },
  ];

  return (
    <AppShell alarme={sinal === "critico" || sinal === "atraso"}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link href="/os" className="font-mono text-xs text-aco-400 hover:text-ambar-500">
          ← Ordens de serviço
        </Link>
        <PrioridadeBadge prioridade={os.prioridade} />
      </div>

      <header className="mb-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-aco-400">
          OS-{os.numero}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold leading-tight tracking-tight text-aco-100">
          {os.equipamento.tipo}
        </h1>
        <p className="mt-1 font-body text-sm text-aco-400">
          {os.cliente.nome} · {TIPO_CLIENTE_ROTULO[os.cliente.tipo] ?? os.cliente.tipo}
          {os.equipamento.placa ? ` · ${os.equipamento.placa}` : ""}
        </p>
        <div className="mt-3">
          <AvisarWhatsapp
            numeroOs={os.numero}
            equipamento={os.equipamento.tipo}
            estado={os.estado}
            whatsapp={os.cliente.whatsapp}
          />
        </div>
      </header>

      {/* O INSTRUMENTO: medidor de estado + responsabilização (o que salta primeiro) */}
      <section
        aria-label="Estado e responsabilização"
        className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_19rem]"
      >
        <div className="rounded-lg border border-grafite-700 bg-grafite-800 p-5">
          <MedidorEstado estado={os.estado} sinal={sinal} prazoLabel={prazoLabel(diasRestantes)} />
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-grafite-700 pt-4">
            {legenda.map((l) => (
              <div key={l.k}>
                <dt className="font-mono text-[11px] uppercase tracking-wide text-aco-400">{l.k}</dt>
                <dd className="mt-0.5 font-body text-sm text-aco-200">{l.v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Responsabilizacao bola={bola} detalhe={detalhe} />
      </section>

      {/* FAIXA DE AÇÃO: o próximo passo, alvo grande */}
      <section className="mt-5 rounded-lg border border-grafite-700 bg-grafite-850 p-4" aria-label="Próximo passo">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-aco-400">Próximo passo</p>
        <AcoesOs
          osId={os.id}
          proximos={proximos}
          podeRecall={os.eventos.length > 0 && os.eventos[0]!.deEstado !== null}
          precisaAprovarCq={os.estado === "controle_qualidade" && !os.cqAprovado}
        />
      </section>

      {/* CORPO: orçamento | triagem */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-label="Orçamento">
          <h2 className="mb-3 font-display text-xl text-aco-100">Orçamento</h2>
          <Orcamento
            osId={os.id}
            estado={os.estado}
            cqAprovado={os.cqAprovado}
            orcamento={orcamento}
            podeEditar={podeEditarOrcamento}
            servicos={servicos}
          />
        </section>

        <section aria-label="Triagem">
          <h2 className="mb-3 font-display text-xl text-aco-100">Triagem</h2>
          <AcoesTriagem
            osId={os.id}
            prioridade={os.prioridade}
            temOverride={os.prioridadeOverride !== null}
            travado={os.travado}
          />
          {podeEditarOs ? (
            <div className="mt-4 rounded-md border border-grafite-700 bg-grafite-800 p-4">
              <EstacaoFisica osId={os.id} estacaoId={os.estacaoId} estacoes={estacoes} />
            </div>
          ) : null}
        </section>
      </div>

      {podeVerFinanceiro && conta ? (
        <div className="mt-5">
          <Financeiro conta={conta} osId={os.id} podeGerir={podeCancelarCobranca} />
        </div>
      ) : null}

      {/* LINHA DO TEMPO: recolhível */}
      <details className="mt-6 rounded-lg border border-grafite-700 bg-grafite-800">
        <summary className="cursor-pointer list-none px-4 py-3 font-display text-lg text-aco-100 [&::-webkit-details-marker]:hidden">
          Linha do tempo
          <span className="ml-2 font-mono text-xs text-aco-400">({os.eventos.length})</span>
        </summary>
        <ol className="relative flex flex-col gap-4 border-l border-grafite-700 px-5 pb-5 pl-9">
          {os.eventos.map((ev, i) => (
            <li key={`${ev.em.toISOString()}-${i}`} className="relative">
              <span
                className="absolute -left-[1.15rem] top-1.5 size-2 rounded-full bg-ambar-500"
                aria-hidden
              />
              <p className="font-body text-sm text-aco-100">
                {ev.deEstado
                  ? `${rotuloEstado(ev.deEstado)} → ${rotuloEstado(ev.paraEstado)}`
                  : `Aberta (${rotuloEstado(ev.paraEstado)})`}
              </p>
              <p className="mt-0.5 font-mono text-xs text-aco-400">{dataHora(ev.em)}</p>
              {ev.motivo ? <p className="mt-0.5 font-body text-xs text-aco-400">{ev.motivo}</p> : null}
            </li>
          ))}
        </ol>
      </details>
    </AppShell>
  );
}
