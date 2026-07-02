import { Skeleton } from "@/ui/components/skeleton";

/** Loading do quiosque do chão: mantém a moldura escura e mostra cards grandes esqueleto. */
export default function CarregandoChao() {
  return (
    <div className="flex min-h-dvh flex-col bg-grafite-900">
      <header className="flex items-center justify-between gap-4 border-b border-grafite-700 px-5 py-4">
        <span className="font-display text-2xl font-bold tracking-tight text-ambar-500">IGNI</span>
        <Skeleton className="h-5 w-24" />
      </header>
      <main className="flex-1 px-5 py-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  );
}
