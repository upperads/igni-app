import { cn } from "@/ui/cn";

/**
 * Trilho de risco — a assinatura periférica. Em repouso é um filete grafite discreto; quando há
 * crítico/atraso, acende com as listras de hazard âmbar a 45°, visível do outro lado da oficina.
 */
export function RiskRail({ alarme = false, className }: { alarme?: boolean; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("h-1.5 w-full", alarme ? "trilho-alarme" : "bg-grafite-700", className)}
    />
  );
}
