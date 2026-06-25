import { cn } from "@/ui/cn";

/** Bloco de carregamento no ritmo do board (pulso de opacidade, não layout). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-grafite-800", className)} aria-hidden />;
}
