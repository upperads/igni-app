import type { ReactNode } from "react";
import { sair } from "@/app/logout/actions";
import { pode } from "@/domain/auth/rbac";
import { sessaoAtual } from "@/infra/auth/sessao";
import { NavLinks, NavLinksMobile } from "./nav-links";
import { RiskRail } from "./risk-rail";
import { ToggleTema } from "./toggle-tema";

const NAV = [
  { href: "/", rotulo: "Painel" },
  { href: "/chao", rotulo: "Chão" },
  { href: "/triagem", rotulo: "Triagem" },
  { href: "/os", rotulo: "OS" },
  { href: "/servicos", rotulo: "Serviços" },
  { href: "/clientes", rotulo: "Clientes" },
  { href: "/relatorio", rotulo: "Relatório" },
  { href: "/painel/tv", rotulo: "Modo TV" },
  { href: "/primeiros-passos", rotulo: "Primeiros passos" },
] as const;

// Itens de configuração — só aparecem para quem pode configurar (dono/gestor).
const NAV_CONFIG = [
  { href: "/config/equipe", rotulo: "Equipe" },
  { href: "/config/estacoes", rotulo: "Estações" },
  { href: "/config/cargos", rotulo: "Cargos" },
] as const;

// Na barra inferior (mobile, zona do polegar): as telas de chão. Chão primeiro; o resto é de desktop.
const NAV_MOBILE = NAV.filter((n) =>
  ["/", "/chao", "/triagem", "/os"].includes(n.href),
);

/** Iniciais da oficina para o avatar (ex.: "Retífica Central" → "RC"). Máx. 2 letras. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) {
    return "?";
  }
  const letras = partes.length === 1 ? partes[0]!.slice(0, 2) : partes[0]![0]! + partes[1]![0]!;
  return letras.toUpperCase();
}

interface Props {
  children: ReactNode;
  /** Acende o trilho de risco (há crítico/atraso na tela). */
  alarme?: boolean;
  /** Rótulo de contexto (ex.: "Setor: Cabeçote"). */
  setor?: string;
}

/**
 * Moldura do app interno: trilho de risco no topo, barra superior (desktop) e navegação inferior
 * na zona do polegar (mobile). O modo TV usa o conteúdo sem esta moldura. Lê a sessão para mostrar
 * os itens de configuração (Equipe/Estações) apenas a quem pode configurar — sem inflar cada página.
 */
export async function AppShell({ children, alarme = false, setor }: Props) {
  const sessao = await sessaoAtual();
  const podeConfigurar = sessao ? pode(sessao.permissoes, "config:editar") : false;
  const nav = podeConfigurar ? [...NAV, ...NAV_CONFIG] : NAV;
  const nomeOficina = sessao?.tenantNome ?? "Igni";
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

        <NavLinks itens={nav} />

        <div className="flex items-center gap-2">
          <span className="hidden max-w-[12rem] truncate font-mono text-xs text-aco-400 md:inline">
            {nomeOficina}
          </span>
          <ToggleTema />
          <span
            className="grid size-9 place-items-center rounded-full bg-grafite-700 font-display text-sm text-aco-100"
            aria-hidden
          >
            {iniciais(nomeOficina)}
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

      <NavLinksMobile itens={NAV_MOBILE} />
    </div>
  );
}
