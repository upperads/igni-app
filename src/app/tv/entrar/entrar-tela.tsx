"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Pareamento da TV: digita o código curto e vai para /tv/{codigo} (a rota aceita token OU código). */
export function EntrarTela() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const c = codigo.trim();
        if (c.length >= 4) router.push(`/tv/${encodeURIComponent(c)}`);
      }}
      className="flex w-full max-w-xs flex-col gap-3"
    >
      <input
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.toUpperCase())}
        aria-label="Código da tela"
        placeholder="Código da tela"
        className="rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 text-center font-mono text-lg tracking-widest text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-md bg-ambar-500 px-4 py-2 font-body text-sm font-medium text-grafite-950 hover:bg-ambar-400"
      >
        Conectar esta tela
      </button>
    </form>
  );
}
