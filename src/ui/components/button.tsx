import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/ui/cn";

type Variante = "primario" | "fantasma";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
}

/** Botão com alvo de toque grande (≥48px, crítico para o "bump" com luva). */
export function Button({ variante = "primario", className, ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-md px-5 font-body text-sm font-semibold tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variante === "primario" && "bg-ambar-500 text-grafite-900 hover:bg-ambar-600",
        variante === "fantasma" && "border border-grafite-600 text-aco-100 hover:bg-grafite-800",
        className,
      )}
      {...props}
    />
  );
}
