"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acaoBumpChao } from "@/app/os/actions";
import type { EstadoOS } from "@/domain/os/estado";
import { rotuloEstado } from "@/domain/os/estado";

/** Botão GIGANTE de avançar a OS no chão. 1 toque, sem digitar. Marca origem='chao' (adoção). */
export function BumpChao({ osId, proximo }: { osId: string; proximo: EstadoOS }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function bump() {
    setErro(null);
    iniciar(async () => {
      const r = await acaoBumpChao(osId, proximo);
      if (!r.ok) {
        setErro(r.motivo ?? "Não deu pra avançar.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={bump}
        disabled={pendente}
        className="min-h-20 w-full rounded-lg bg-ambar-500 px-4 font-display text-2xl font-bold tracking-wide text-grafite-900 transition-colors hover:bg-ambar-600 active:scale-[0.99] disabled:opacity-60"
      >
        {pendente ? "…" : `PRONTO → ${rotuloEstado(proximo)}`}
      </button>
      {erro ? (
        <p role="alert" className="mt-2 font-body text-base text-sinal-vermelho">
          {erro}
        </p>
      ) : null}
    </>
  );
}
