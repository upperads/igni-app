"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type EstadoOS, rotuloEstado } from "@/domain/os/estado";
import type { Sinal } from "@/domain/os/painel";
import { acaoTransicionar } from "@/app/os/actions";
import { OsCard } from "@/ui/components/os-card";

interface Props {
  id: string;
  codigo: string;
  equipamento: string;
  responsavel: string | null;
  prazoLabel: string;
  sinal: Sinal;
  travado: boolean;
  proximoBump: EstadoOS | null;
}

/**
 * Card do painel interativo com "bump" (US-10): o corpo abre a OS; o botão grande avança a etapa
 * com a mão suja. Gate barrado mostra o motivo (sem mover). O modo TV (público) não usa este card.
 */
export function CardPainelBump(props: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const proximo = props.proximoBump;

  function bump() {
    if (!proximo) {
      return;
    }
    setErro(null);
    iniciar(async () => {
      const r = await acaoTransicionar(props.id, proximo);
      if (!r.ok) {
        setErro(r.motivo ?? "Bump barrado.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Link href={`/os/${props.id}`} className="block">
        <OsCard
          codigo={props.codigo}
          equipamento={props.equipamento}
          responsavel={props.responsavel}
          prazo={props.prazoLabel}
          sinal={props.sinal}
          travado={props.travado}
        />
      </Link>
      {proximo ? (
        <button
          type="button"
          onClick={bump}
          disabled={pendente}
          className="min-h-12 rounded-md border border-grafite-600 bg-grafite-800 px-3 font-body text-sm font-semibold text-aco-100 transition-colors hover:bg-grafite-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendente ? "…" : `Bump → ${rotuloEstado(proximo)}`}
        </button>
      ) : null}
      {erro ? (
        <p role="alert" className="font-mono text-xs text-sinal-vermelho">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
