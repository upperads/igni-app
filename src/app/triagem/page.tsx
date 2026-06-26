import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { rotuloEstado } from "@/domain/os/estado";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarTriagem } from "@/infra/composition/os";
import { AppShell } from "@/ui/components/app-shell";
import { CabecalhoTela } from "@/ui/components/cabecalho-tela";
import { PrioridadeBadge } from "@/ui/components/prioridade-badge";
import { TravamentoSelo } from "@/ui/components/travamento-selo";

export const metadata: Metadata = {
  title: "Triagem — Igni",
};

export default async function TriagemPage() {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }

  const fila = await listarTriagem(sessao);
  const temCritica = fila.some((i) => i.prioridade === "critica");

  return (
    <AppShell alarme={temCritica}>
      <CabecalhoTela
        etiqueta="Fila"
        titulo="Triagem"
        sub="A fila ordenada por impacto: prazo contra trabalho restante, mais os gatilhos do seu ramo. Quem está travado por causa do cliente cede a vez; por causa da oficina, mantém."
      />

      {fila.length === 0 ? (
        <div className="rounded-lg border border-dashed border-grafite-600 bg-grafite-850 px-6 py-12 text-center">
          <p className="font-display text-lg text-aco-100">Fila vazia.</p>
          <p className="mx-auto mt-1 max-w-prose font-body text-sm text-aco-400">
            Sem OS ativas no momento. Quando houver, elas aparecem aqui na ordem certa.
          </p>
          <Link href="/os/nova" className="mt-5 inline-flex font-mono text-sm text-ambar-500 hover:underline">
            Abrir uma OS →
          </Link>
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {fila.map((item, i) => (
            <li key={item.id}>
              <Link
                href={`/os/${item.id}`}
                className="flex items-center gap-3 rounded-md border border-grafite-700 bg-grafite-800 px-4 py-3 transition-colors hover:border-grafite-600"
              >
                <span className="w-6 shrink-0 text-center font-mono text-sm tabular-nums text-aco-400">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg leading-tight text-aco-100">
                    {item.equipamento}
                  </p>
                  <p className="truncate font-body text-xs text-aco-400">
                    {item.clienteNome} · {rotuloEstado(item.estado)}
                  </p>
                </div>
                {item.travado ? (
                  <TravamentoSelo responsabilidade={item.travamentoResponsabilidade} />
                ) : null}
                <PrioridadeBadge prioridade={item.prioridade} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </AppShell>
  );
}
