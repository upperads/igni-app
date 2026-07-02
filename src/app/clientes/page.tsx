import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ROTULO_TIPO_CLIENTE, type TipoCliente } from "@/domain/os/cliente";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarClientesNoTenant } from "@/infra/composition/clientes";
import { AppShell } from "@/ui/components/app-shell";
import { CabecalhoTela } from "@/ui/components/cabecalho-tela";
import { telefone } from "@/ui/format";

export const metadata: Metadata = {
  title: "Clientes — Igni",
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }

  const { q } = await searchParams;
  const termo = (q ?? "").trim();
  const clientes = await listarClientesNoTenant(sessao, termo);

  return (
    <AppShell>
      <CabecalhoTela
        etiqueta="Cadastro"
        titulo="Clientes"
        sub="Quem a oficina atende. Cada um aqui é único: ao abrir uma OS com o mesmo WhatsApp, o Igni reaproveita o cliente em vez de duplicar."
        acao={
          <form className="flex gap-2" action="/clientes">
            <input
              name="q"
              defaultValue={termo}
              placeholder="Buscar por nome ou WhatsApp"
              className="w-56 rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-md border border-grafite-600 px-3 py-2 font-mono text-sm text-aco-200 hover:text-aco-100"
            >
              Buscar
            </button>
          </form>
        }
      />

      {clientes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-grafite-600 bg-grafite-850 px-6 py-12 text-center">
          <p className="font-display text-lg text-aco-100">
            {termo ? "Nenhum cliente encontrado." : "Ainda não há clientes."}
          </p>
          <p className="mx-auto mt-1 max-w-prose font-body text-sm text-aco-400">
            {termo ? (
              <>
                Nada bate com “{termo}”.{" "}
                <Link href="/clientes" className="text-ambar-500 hover:underline">
                  Limpar busca
                </Link>
              </>
            ) : (
              "Os clientes aparecem aqui conforme você abre OS — e cada WhatsApp vira um cliente só."
            )}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {clientes.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clientes/${c.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-grafite-700 bg-grafite-850 px-4 py-3 transition-colors hover:border-ambar-500/60"
              >
                <div className="min-w-0">
                  <p className="truncate font-body text-sm text-aco-100">{c.nome}</p>
                  <p className="truncate font-mono text-xs text-aco-500">
                    {ROTULO_TIPO_CLIENTE[c.tipo as TipoCliente]}
                    {c.whatsapp ? ` · ${telefone(c.whatsapp)}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-aco-400">
                  {c.totalOs} {c.totalOs === 1 ? "OS" : "OS"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
