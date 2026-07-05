import { AppShell } from "@/ui/components/app-shell";
import { Skeleton } from "@/ui/components/skeleton";

/** Skeleton da Home/painel (a tela mais pesada): dá feedback imediato na navegação enquanto o
 * server component resolve as leituras. */
export default function CarregandoPainel() {
  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-40" />
      </div>
      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      {/* Board */}
      <div className="flex flex-col gap-6">
        {[0, 1, 2].map((etapa) => (
          <div key={etapa}>
            <Skeleton className="mb-3 h-6 w-40" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2].map((c) => (
                <Skeleton key={c} className="h-28" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
