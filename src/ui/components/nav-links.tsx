"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/ui/cn";

export interface ItemNav {
  href: string;
  rotulo: string;
}

/** Marca a rota atual (o item cujo href casa com o pathname; "/" só casa exato). */
function ativo(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Navegação principal (desktop) com a rota ATUAL destacada (aria-current + fundo âmbar sutil). */
export function NavLinks({ itens }: { itens: readonly ItemNav[] }) {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
      {itens.map((n) => {
        const atual = ativo(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={atual ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 font-body text-sm transition-colors",
              atual
                ? "bg-ambar-500/12 text-aco-100"
                : "text-aco-200 hover:bg-grafite-800 hover:text-aco-100",
            )}
          >
            {n.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

/** Navegação inferior (mobile, zona do polegar) com a rota atual em âmbar. */
export function NavLinksMobile({ itens }: { itens: readonly ItemNav[] }) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-grafite-700 bg-grafite-850 md:hidden"
      aria-label="Navegação principal (mobile)"
    >
      {itens.map((n) => {
        const atual = ativo(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={atual ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center px-1 py-2 font-body text-[11px] transition-colors",
              atual ? "text-ambar-500" : "text-aco-200 hover:text-ambar-500",
            )}
          >
            {n.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
