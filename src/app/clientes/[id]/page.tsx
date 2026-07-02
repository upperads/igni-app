import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ROTULO_TIPO_CLIENTE, type TipoCliente } from "@/domain/os/cliente";
import { rotuloEstado } from "@/domain/os/estado";
import { sessaoAtual } from "@/infra/auth/sessao";
import { detalheClienteNoTenant } from "@/infra/composition/clientes";
import { AppShell } from "@/ui/components/app-shell";
import { data, telefone } from "@/ui/format";

export const metadata: Metadata = {
  title: "Cliente — Igni",
};

export default async function ClienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }

  const cliente = await detalheClienteNoTenant(sessao, id);
  if (!cliente) {
    notFound();
  }

  return (
    <AppShell>
      <div className="mb-3">
        <Link href="/clientes" className="font-mono text-xs text-aco-400 hover:text-ambar-500">
          ← Clientes
        </Link>
      </div>

      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-aco-400">
          {ROTULO_TIPO_CLIENTE[cliente.tipo as TipoCliente]}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-aco-100">
          {cliente.nome}
        </h1>
        <p className="mt-1 font-body text-sm text-aco-400">
          {cliente.whatsapp ? `WhatsApp ${telefone(cliente.whatsapp)} · ` : ""}
          {cliente.totalOs} {cliente.totalOs === 1 ? "ordem de serviço" : "ordens de serviço"}
          {" · "}cliente desde {data(cliente.criadoEm)}
        </p>
      </header>

      <h2 className="mb-3 font-display text-xl text-aco-100">Histórico</h2>
      {cliente.os.length === 0 ? (
        <p className="rounded-lg border border-dashed border-grafite-600 bg-grafite-850 px-4 py-8 text-center font-body text-sm text-aco-400">
          Este cliente ainda não tem OS.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cliente.os.map((o) => (
            <li key={o.id}>
              <Link
                href={`/os/${o.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-grafite-700 bg-grafite-850 px-4 py-3 transition-colors hover:border-ambar-500/60"
              >
                <div className="min-w-0">
                  <p className="truncate font-body text-sm text-aco-100">
                    <span className="font-mono text-aco-400">OS-{o.numero}</span> · {o.equipamento}
                  </p>
                  <p className="font-mono text-xs text-aco-500">{data(o.criadoEm)}</p>
                </div>
                <span className="shrink-0 font-mono text-xs text-aco-300">
                  {rotuloEstado(o.estado)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
