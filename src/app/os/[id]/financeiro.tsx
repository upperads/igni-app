"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ContaView } from "@/infra/composition/conta";
import { moeda } from "@/ui/format";
import { acaoCancelarCobranca } from "../actions";

const ROTULO: Record<ContaView["status"], string> = {
  aberta: "a receber",
  recebida: "recebido",
  cancelada: "cancelado",
};

const COR: Record<ContaView["status"], string> = {
  aberta: "text-ambar-500",
  recebida: "text-sinal-verde",
  cancelada: "text-aco-500",
};

/**
 * Bloco Financeiro do detalhe da OS (P-4a): mostra a conta a receber (valor + status) e permite
 * CANCELAR a cobrança (só quando aberta E o cargo tem financeiro:gerir). A baixa é P-4b.
 */
export function Financeiro({ conta, osId, podeCancelar }: { conta: ContaView; osId: string; podeCancelar: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function cancelar() {
    setErro(null);
    iniciar(async () => {
      const r = await acaoCancelarCobranca(conta.id, osId);
      if (!r.ok) {
        setErro(r.motivo ?? "Não deu certo.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section aria-label="Financeiro" className="rounded-lg border border-grafite-700 bg-grafite-850 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-aco-400">Financeiro</p>
          <p className="mt-1 font-display text-xl text-aco-100">
            {moeda(conta.valorCentavos)} <span className={`font-body text-sm ${COR[conta.status]}`}>· {ROTULO[conta.status]}</span>
          </p>
        </div>
        {conta.status === "aberta" && podeCancelar ? (
          <button
            type="button"
            onClick={cancelar}
            disabled={pendente}
            className="rounded-md border border-grafite-600 px-3 py-1.5 font-body text-sm text-aco-400 hover:border-sinal-vermelho hover:text-sinal-vermelho disabled:opacity-50"
          >
            Cancelar cobrança
          </button>
        ) : null}
      </div>
      {erro ? <p role="alert" className="mt-2 font-body text-sm text-sinal-vermelho">{erro}</p> : null}
    </section>
  );
}
