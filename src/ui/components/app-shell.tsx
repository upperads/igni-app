import Link from "next/link";
import type { ReactNode } from "react";
import { sair } from "@/app/logout/actions";
import { cn } from "@/ui/cn";
import { RiskRail } from "./risk-rail";

const NAV = [
  { href: "/", rotulo: "Painel" },
  { href: "/triagem", rotulo: "Triagem" },
  { href: "/os", rotulo: "OS" },
  { href: "/cadastros", rotulo: "Cadastros" },
] as const;

interface Props {
  children: ReactNode;
  /** Acende o trilho de risco (há crítico/atraso na tela). */
  alarme?: boolean;
  /** Rótulo de contexto (ex.: "Setor: Cabeçote"). */
  setor?: string;
}

/**
 * Moldura do app interno: trilho de risco no topo, barra superior (desktop) e navegação inferior
 * na zona do polegar (mobile). O modo TV usa o conteúdo sem esta moldura.
 */
export function AppShell({ children, alarme = false, setor }: Props) {
  return (
    <div className="flex min-h-dvh flex-col bg-grafite-900">
      <RiskRail alarme={alarme} />

      <header className="flex items-center justify-between gap-4 border-b border-grafite-700 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl font-bold tracking-tight text-ambar-500">IGNI</span>
          {setor ? (
            <span className="hidden font-mono text-xs uppercase tracking-widest text-aco-400 sm:inline">
              {setor}
            </span>
          ) : null}
        </div>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 font-body text-sm text-aco-200 transition-colors hover:bg-grafite-800 hover:text-aco-100"
            >
              {n.rotulo}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-xs text-aco-400 md:inline">Retífica Central</span>
          <span
            className="grid size-9 place-items-center rounded-full bg-grafite-700 font-display text-sm text-aco-100"
            aria-hidden
          >
            RC
          </span>
          <form action={sair}>
            <button
              type="submit"
              className="rounded-md px-2 py-2 font-body text-sm text-aco-400 transition-colors hover:text-aco-100"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-4 pt-6 pb-24 md:px-6 md:pb-8">{children}</main>

      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-grafite-700 bg-grafite-850 md:hidden",
        )}
        aria-label="Navegação principal (mobile)"
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="flex min-h-14 flex-col items-center justify-center px-1 py-2 font-body text-[11px] text-aco-200 transition-colors hover:text-ambar-500"
          >
            {n.rotulo}
          </Link>
        ))}
      </nav>
    </div>
  );
}
