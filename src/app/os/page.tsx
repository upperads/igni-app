import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { rotuloEstado } from "@/domain/os/estado";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarOs, listarTriagem } from "@/infra/composition/os";
import { AppShell } from "@/ui/components/app-shell";
import { Button } from "@/ui/components/button";
import { CabecalhoTela } from "@/ui/components/cabecalho-tela";
import { EstadoBadge } from "@/ui/components/estado-badge";
import { PrioridadeBadge } from "@/ui/components/prioridade-badge";
import { TravamentoSelo } from "@/ui/components/travamento-selo";
import { data } from "@/ui/format";

export const metadata: Metadata = {
  title: "Ordens de serviço — Igni",
};

type Modo = "impacto" | "todas";

/**
 * Ordens de serviço — uma tela, dois modos (fusão de /os + /triagem):
 * - `impacto` (padrão): a fila ATIVA ordenada pela regra da vez (era /triagem) — o que fazer primeiro.
 * - `todas`: TODAS as OS em ordem cronológica, inclui entregues (o índice/cadastro) + "Nova OS".
 * O modo vem por `?modo=` (mesmo padrão do /chao). Sem modo = impacto.
 */
export default async function OsPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }

  const { modo: modoBruto } = await searchParams;
  const modo: Modo = modoBruto === "todas" ? "todas" : "impacto";

  const fila = modo === "impacto" ? await listarTriagem(sessao) : [];
  const lista = modo === "todas" ? await listarOs(sessao) : [];
  const temCritica = modo === "impacto" && fila.some((i) => i.prioridade === "critica");

  return (
    <AppShell alarme={temCritica}>
      <CabecalhoTela
        etiqueta="Oficina"
        titulo="Ordens de serviço"
        sub="Do que fazer agora (por impacto) ao histórico completo. Cada OS é rastreável da entrada à entrega."
        acao={
          <Link href="/os/nova">
            <Button>Nova OS</Button>
          </Link>
        }
      />

      {/* Abas de modo (mesmo padrão de filtro do /chao) */}
      <div className="mb-4 flex gap-1 rounded-md border border-grafite-700 bg-grafite-850 p-1">
        <Aba href="/os?modo=impacto" ativa={modo === "impacto"}>
          Por impacto
        </Aba>
        <Aba href="/os?modo=todas" ativa={modo === "todas"}>
          Todas
        </Aba>
      </div>

      {modo === "impacto" ? (
        <FilaPorImpacto fila={fila} />
      ) : (
        <ListaTodas lista={lista} />
      )}
    </AppShell>
  );
}

function Aba({ href, ativa, children }: { href: string; ativa: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={ativa ? "page" : undefined}
      className={`flex-1 rounded px-3 py-1.5 text-center font-body text-sm transition-colors ${
        ativa ? "bg-grafite-700 text-aco-100" : "text-aco-400 hover:text-aco-100"
      }`}
    >
      {children}
    </Link>
  );
}

function FilaPorImpacto({ fila }: { fila: Awaited<ReturnType<typeof listarTriagem>> }) {
  if (fila.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-grafite-600 bg-grafite-850 px-6 py-12 text-center">
        <p className="font-display text-lg text-aco-100">Fila vazia.</p>
        <p className="mx-auto mt-1 max-w-prose font-body text-sm text-aco-400">
          Sem OS ativas no momento. Quando houver, elas aparecem aqui na ordem certa.
        </p>
        <Link href="/os/nova" className="mt-5 inline-flex font-mono text-sm text-ambar-500 hover:underline">
          Abrir uma OS →
        </Link>
      </div>
    );
  }
  return (
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
                OS-{item.numero} · {item.clienteNome} · {rotuloEstado(item.estado)}
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
  );
}

function ListaTodas({ lista }: { lista: Awaited<ReturnType<typeof listarOs>> }) {
  if (lista.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-grafite-600 bg-grafite-850 px-6 py-12 text-center">
        <p className="font-display text-lg text-aco-100">Nenhuma OS por aqui ainda.</p>
        <p className="mx-auto mt-1 max-w-prose font-body text-sm text-aco-400">
          Quando um equipamento entrar na oficina, abra a OS. A partir dali, todo mundo enxerga onde
          ela está e o que falta.
        </p>
        <Link href="/os/nova" className="mt-5 inline-flex">
          <Button>Abrir a primeira OS</Button>
        </Link>
      </div>
    );
  }
  return (
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
  );
}
