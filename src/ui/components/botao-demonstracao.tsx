"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  acaoLimparDemonstracao,
  acaoPreencherDemonstracao,
} from "@/app/config/demonstracao/actions";

/**
 * Preencher/limpar a demonstração (I5). Quando a oficina está vazia, oferece encher com um cenário
 * de venda completo — para o dono ver o app no auge antes de usar pra valer (e para demonstrar numa
 * venda). Quando já há demo, oferece limpar (com confirmação — é destrutivo, mas só toca no que é
 * de demonstração). Some o atrito: um clique, reversível.
 */
export function BotaoDemonstracao({ temDemo }: { temDemo: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false);

  function preencher() {
    setErro(null);
    iniciar(async () => {
      const r = await acaoPreencherDemonstracao();
      if (!r.ok) {
        setErro(r.motivo ?? "Não deu certo.");
        return;
      }
      router.refresh();
    });
  }

  function limpar() {
    setErro(null);
    setConfirmandoLimpar(false);
    iniciar(async () => {
      const r = await acaoLimparDemonstracao();
      if (!r.ok) {
        setErro(r.motivo ?? "Não deu certo.");
        return;
      }
      router.refresh();
    });
  }

  if (temDemo) {
    return (
      <div className="flex flex-col gap-2">
        {confirmandoLimpar ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-body text-sm text-aco-300">
              Apagar só as OS de demonstração? Seus dados reais ficam intactos.
            </span>
            <button
              type="button"
              onClick={limpar}
              disabled={pendente}
              className="rounded-md bg-sinal-vermelho px-3 py-1.5 font-mono text-xs text-grafite-900 disabled:opacity-50"
            >
              {pendente ? "Limpando…" : "Limpar demonstração"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoLimpar(false)}
              className="rounded-md px-3 py-1.5 font-mono text-xs text-aco-400 hover:text-aco-100"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmandoLimpar(true)}
            disabled={pendente}
            className="self-start rounded-md border border-grafite-600 px-3 py-1.5 font-mono text-xs text-aco-300 transition-colors hover:border-sinal-vermelho hover:text-sinal-vermelho disabled:opacity-50"
          >
            Limpar demonstração
          </button>
        )}
        {erro ? (
          <p role="alert" className="font-body text-sm text-sinal-vermelho">
            {erro}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={preencher}
        disabled={pendente}
        className="self-start rounded-md border border-grafite-600 bg-grafite-800 px-4 py-2 font-display text-sm font-bold text-aco-100 transition-colors hover:border-ambar-500 hover:text-ambar-500 disabled:opacity-50"
      >
        {pendente ? "Preenchendo…" : "Preencher com exemplo"}
      </button>
      <p className="font-body text-xs text-aco-400">
        Cria OS de exemplo em todos os estágios para você ver o painel, o relatório e a TV cheios.
        Some quando quiser — é só limpar, e seus dados reais não são tocados.
      </p>
      {erro ? (
        <p role="alert" className="font-body text-sm text-sinal-vermelho">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
