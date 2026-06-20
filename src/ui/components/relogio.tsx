"use client";

import { useEffect, useState } from "react";

/** Relógio do modo TV: começa vazio (evita mismatch SSR) e atualiza a cada minuto no cliente. */
export function Relogio({ className }: { className?: string }) {
  const [hora, setHora] = useState("");

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const tick = () => setHora(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={className} suppressHydrationWarning>
      {hora}
    </span>
  );
}
