"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/infra/auth/supabase-browser";
import { cn } from "@/ui/cn";

/**
 * Assina o tópico de Realtime do tenant (ADR-010) e atualiza o painel ao vivo a cada "ping". O sinal
 * vem pelo canal; os dados vêm do refetch (router.refresh), que passa pela RLS. Mostra um indicador
 * discreto de ao vivo/reconectando — e mantém o último estado na tela se cair (RNF-DISP-01).
 */
export function RealtimePainel({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [aoVivo, setAoVivo] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const canal = supabase
      .channel(`painel:${tenantId}`)
      .on("broadcast", { event: "mudou" }, () => router.refresh())
      .subscribe((status) => {
        setAoVivo(status === "SUBSCRIBED");
      });

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [tenantId, router]);

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-aco-400">
      <span
        className={cn("size-2 rounded-full", aoVivo ? "bg-sinal-verde" : "bg-ambar-500")}
        aria-hidden
      />
      {aoVivo ? "Ao vivo" : "Reconectando…"}
    </span>
  );
}
