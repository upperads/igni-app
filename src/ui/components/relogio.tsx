"use client";

import { useEffect, useState } from "react";
import { hora } from "@/ui/format";

/** Relógio do modo TV: começa vazio (evita mismatch SSR) e atualiza a cada minuto no cliente. */
export function Relogio({ className }: { className?: string }) {
  const [texto, setTexto] = useState("");

  useEffect(() => {
    const tick = () => setTexto(hora(new Date()));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={className} suppressHydrationWarning>
      {texto}
    </span>
  );
}
