import { AppShell } from "@/ui/components/app-shell";
import { Skeleton } from "@/ui/components/skeleton";

export default function CarregandoTriagem() {
  return (
    <AppShell>
      <Skeleton className="mb-6 h-8 w-40" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </AppShell>
  );
}
