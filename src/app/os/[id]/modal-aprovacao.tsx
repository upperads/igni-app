"use client";

import { useState } from "react";
import {
  type CanalAprovacao,
  CANAIS_APROVACAO,
  ROTULO_CANAL_APROVACAO,
} from "@/domain/orcamento/orcamento";
import { Button } from "@/ui/components/button";

const ROTULO_BOTAO: Record<CanalAprovacao, string> = {
  telefone: "Por telefone",
  pessoalmente: "Pessoalmente",
  whatsapp: "Por WhatsApp",
};

interface Props {
  pendente: boolean;
  /** Aprovar registrando COMO o cliente aprovou (vira evento na linha do tempo). */
  onAprovar: (canal: CanalAprovacao) => void;
  onRecusar: () => void;
}

/**
 * Decisão do orçamento PELA OPERAÇÃO (o cliente aprovou por fora). Botão claro abre um modal que
 * pergunta COMO o cliente aprovou — esse registro mantém a responsabilização honesta (fica gravado
 * que esperamos o cliente, e por qual canal ele respondeu). Recusar é direto.
 */
export function DecisaoOrcamento({ pendente, onAprovar, onRecusar }: Props) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="mt-4">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-aco-400">
        O cliente já respondeu?
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pendente} onClick={() => setAberto(true)}>
          Registrar aprovação
        </Button>
        <Button variante="fantasma" disabled={pendente} onClick={onRecusar}>
          Registrar recusa
        </Button>
      </div>
      <p className="mt-2 font-body text-xs text-aco-400">
        Use quando o cliente aprovou por telefone, pessoalmente ou WhatsApp. Fica registrado na linha
        do tempo — sem isso, o sistema não saberia que a espera era com ele.
      </p>

      {aberto ? (
        <ModalCanal
          pendente={pendente}
          onEscolher={(canal) => {
            setAberto(false);
            onAprovar(canal);
          }}
          onFechar={() => setAberto(false)}
        />
      ) : null}
    </div>
  );
}

function ModalCanal({
  pendente,
  onEscolher,
  onFechar,
}: {
  pendente: boolean;
  onEscolher: (canal: CanalAprovacao) => void;
  onFechar: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Como o cliente aprovou"
      className="fixed inset-0 z-50 grid place-items-center bg-grafite-900/80 p-4"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-grafite-600 bg-grafite-850 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg text-aco-100">Como o cliente aprovou?</h2>
        <p className="mt-1 font-body text-sm text-aco-400">
          Isso vira um registro na linha do tempo da OS. Escolha o canal:
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {CANAIS_APROVACAO.map((canal) => (
            <button
              key={canal}
              type="button"
              disabled={pendente}
              onClick={() => onEscolher(canal)}
              className="flex items-center justify-between rounded-md border border-grafite-600 bg-grafite-800 px-4 py-3 text-left font-body text-sm text-aco-100 transition-colors hover:border-ambar-500 hover:text-ambar-500 disabled:opacity-50"
            >
              <span>{ROTULO_BOTAO[canal]}</span>
              <span className="font-mono text-xs text-aco-400">
                aprovado {ROTULO_CANAL_APROVACAO[canal]}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="mt-4 w-full rounded-md px-4 py-2 font-body text-sm text-aco-400 hover:text-aco-100"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
