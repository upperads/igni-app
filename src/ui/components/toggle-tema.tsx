"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/ui/cn";

type Tema = "escuro" | "claro";

function lerTema(): Tema {
  return document.documentElement.dataset.tema === "claro" ? "claro" : "escuro";
}

// Assina o <html> p/ refletir o data-tema sem setState-in-effect (o script anti-FOUC já o aplicou).
function assinar(callback: () => void): () => void {
  const obs = new MutationObserver(callback);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
  return () => obs.disconnect();
}

/** Alterna claro/escuro persistindo em localStorage + `data-tema` no <html>. Escuro é o default. */
export function ToggleTema({ className }: { className?: string }) {
  const tema = useSyncExternalStore(assinar, lerTema, () => "escuro" as Tema);

  function alternar() {
    const proximo: Tema = tema === "escuro" ? "claro" : "escuro";
    localStorage.setItem("igni-tema", proximo);
    if (proximo === "claro") {
      document.documentElement.dataset.tema = "claro";
    } else {
      delete document.documentElement.dataset.tema;
    }
    // o useSyncExternalStore reflete a mudança do data-tema (MutationObserver).
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={tema === "escuro" ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={tema === "escuro" ? "Tema claro" : "Tema escuro"}
      className={cn(
        "grid size-9 place-items-center rounded-md border border-grafite-600 text-aco-300 transition-colors hover:text-aco-100",
        className,
      )}
    >
      <span aria-hidden className="font-mono text-sm">
        {tema === "escuro" ? "☀" : "☾"}
      </span>
    </button>
  );
}
