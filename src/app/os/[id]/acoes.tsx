"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type EstadoOS, rotuloEstado } from "@/domain/os/estado";
import { Button } from "@/ui/components/button";
import { acaoTransicionar } from "../actions";

/** Ações de transição: um botão por próximo estado estruturalmente permitido. Gate barrado mostra o motivo. */
export function AcoesOs({ osId, proximos }: { osId: string; proximos: readonly EstadoOS[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  if (proximos.length === 0) {
    return (
      <p className="font-body text-sm text-aco-400">
        OS finalizada. Não há próximo passo na linha.
      </p>
    );
  }

  function mover(para: EstadoOS) {
    setErro(null);
    iniciar(async () => {
      const r = await acaoTransicionar(osId, para);
      if (!r.ok) {
        setErro(r.motivo ?? "Não foi possível avançar a OS.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {proximos.map((para) => (
          <Button
            key={para}
            variante="fantasma"
            disabled={pendente}
            onClick={() => mover(para)}
          >
            Mover para {rotuloEstado(para)}
          </Button>
        ))}
      </div>
      {erro ? (
        <p role="alert" className="font-body text-sm text-sinal-vermelho">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
