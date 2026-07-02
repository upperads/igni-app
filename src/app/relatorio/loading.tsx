import { AppShell } from "@/ui/components/app-shell";
import { Skeleton } from "@/ui/components/skeleton";

export default function CarregandoRelatorio() {
  return (
    <AppShell>
      <Skeleton className="mb-6 h-8 w-48" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="mt-6 h-24" />
    </AppShell>
  );
}
