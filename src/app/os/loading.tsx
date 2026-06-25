import { AppShell } from "@/ui/components/app-shell";
import { Skeleton } from "@/ui/components/skeleton";

export default function CarregandoOs() {
  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-12 w-28" />
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </AppShell>
  );
}
