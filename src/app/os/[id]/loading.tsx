import { AppShell } from "@/ui/components/app-shell";
import { Skeleton } from "@/ui/components/skeleton";

export default function CarregandoDetalhe() {
  return (
    <AppShell>
      <Skeleton className="mb-2 h-4 w-40" />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-7 w-28 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="mt-8 h-12 w-48" />
    </AppShell>
  );
}
