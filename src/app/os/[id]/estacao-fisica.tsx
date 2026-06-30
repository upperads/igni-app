"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acaoAtribuirEstacao } from "../actions";

interface Props {
  osId: string;
  estacaoId: string | null;
  estacoes: { id: string; nome: string }[];
}

/**
 * Seletor da ESTAÇÃO FÍSICA da OS (I7): em qual posto do chão o trabalho está, separado do ESTADO
 * lógico (a etapa da máquina). Muda na hora (server action + refresh). "Sem estação" desatribui.
 */
export function EstacaoFisica({ osId, estacaoId, estacoes }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function mudar(valor: string) {
    setErro(null);
    iniciar(async () => {
      const r = await acaoAtribuirEstacao(osId, valor);
      if (!r.ok) {
        setErro(r.motivo ?? "Não deu certo.");
        return;
      }
      router.refresh();
    });
  }

  if (estacoes.length === 0) {
    return (
      <p className="font-body text-sm text-aco-400">
        Nenhuma estação cadastrada. Configure em{" "}
        <a href="/config/estacoes" className="text-ambar-500 hover:underline">
          Estações
        </a>
        .
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="estacao-fisica" className="font-mono text-[11px] uppercase tracking-wide text-aco-400">
        Estação no chão
      </label>
      <select
        id="estacao-fisica"
        value={estacaoId ?? ""}
        disabled={pendente}
        onChange={(e) => mudar(e.target.value)}
        className="rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 focus:border-ambar-500 focus:outline-none disabled:opacity-50"
      >
        <option value="">— Sem estação —</option>
        {estacoes.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
      </select>
      {erro ? (
        <p role="alert" className="font-body text-sm text-sinal-vermelho">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
