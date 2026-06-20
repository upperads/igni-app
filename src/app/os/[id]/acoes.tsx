"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type EstadoOS, rotuloEstado } from "@/domain/os/estado";
import { Button } from "@/ui/components/button";
import { acaoRecall, acaoTransicionar } from "../actions";

/**
 * Ações de avanço da OS: o "bump" (único passo adiante) vira botão primário; estados que ramificam
 * mostram as opções; e o recall desfaz a última transição. Gate barrado mostra o motivo.
 */
export function AcoesOs({
  osId,
  proximos,
  podeRecall,
}: {
  osId: string;
  proximos: readonly EstadoOS[];
  podeRecall: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function rodar(acao: () => Promise<{ ok: boolean; motivo?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) {
        setErro(r.motivo ?? "Não foi possível concluir a ação.");
        return;
      }
      router.refresh();
    });
  }

  const bump = proximos.length === 1 ? proximos[0]! : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {bump ? (
          <Button disabled={pendente} onClick={() => rodar(() => acaoTransicionar(osId, bump))}>
            Bump → {rotuloEstado(bump)}
          </Button>
        ) : (
          proximos.map((para) => (
            <Button
              key={para}
              variante="fantasma"
              disabled={pendente}
              onClick={() => rodar(() => acaoTransicionar(osId, para))}
            >
              Mover para {rotuloEstado(para)}
            </Button>
          ))
        )}
        {podeRecall ? (
          <Button variante="fantasma" disabled={pendente} onClick={() => rodar(() => acaoRecall(osId))}>
            Desfazer
          </Button>
        ) : null}
      </div>
      {proximos.length === 0 ? (
        <p className="font-body text-sm text-aco-400">OS finalizada. Não há próximo passo na linha.</p>
      ) : null}
      {erro ? (
        <p role="alert" className="font-body text-sm text-sinal-vermelho">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
