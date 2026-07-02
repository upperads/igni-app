import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarOs } from "@/infra/composition/os";
import { AppShell } from "@/ui/components/app-shell";
import { Button } from "@/ui/components/button";
import { CabecalhoTela } from "@/ui/components/cabecalho-tela";
import { EstadoBadge } from "@/ui/components/estado-badge";
import { data } from "@/ui/format";

export const metadata: Metadata = {
  title: "Ordens de serviço — Igni",
};

export default async function OsPage() {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }

  const lista = await listarOs(sessao);

  return (
    <AppShell>
      <CabecalhoTela
        etiqueta="Oficina"
        titulo="Ordens de serviço"
        sub="Cada OS é rastreável da entrada à entrega. Abra uma nova ou acompanhe as que já estão na casa."
        acao={
          <Link href="/os/nova">
            <Button>Nova OS</Button>
          </Link>
        }
      />

      {lista.length === 0 ? (
        <div className="rounded-lg border border-dashed border-grafite-600 bg-grafite-850 px-6 py-12 text-center">
          <p className="font-display text-lg text-aco-100">Nenhuma OS por aqui ainda.</p>
          <p className="mx-auto mt-1 max-w-prose font-body text-sm text-aco-400">
            Quando um equipamento entrar na oficina, abra a OS. A partir dali, todo mundo enxerga
            onde ela está e o que falta.
          </p>
          <Link href="/os/nova" className="mt-5 inline-flex">
            <Button>Abrir a primeira OS</Button>
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((item) => (
            <li key={item.id}>
              <Link
                href={`/os/${item.id}`}
                className="flex items-center gap-4 rounded-md border border-grafite-700 bg-grafite-800 px-4 py-3 transition-colors hover:border-grafite-600"
              >
                <span className="shrink-0 font-mono text-xs tabular-nums text-aco-400">
                  OS-{item.numero}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg leading-tight text-aco-100">
                    {item.equipamento}
                  </p>
                  <p className="truncate font-body text-xs text-aco-400">{item.clienteNome}</p>
                </div>
                <EstadoBadge estado={item.estado} />
                <span className="hidden w-20 shrink-0 text-right font-mono text-xs tabular-nums text-aco-400 sm:inline">
                  {data(item.criadoEm)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
