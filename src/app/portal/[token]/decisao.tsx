"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acaoAprovarPortal, acaoRecusarPortal } from "./actions";

/** Aprovar/recusar o orçamento pelo link (sem login). Alvo de toque grande; confirmação inline. */
export function DecisaoPortal({ token }: { token: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function decidir(acao: () => Promise<{ ok: boolean; motivo?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) {
        setErro(r.motivo ?? "Não foi possível registrar sua resposta.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={pendente}
          onClick={() => decidir(() => acaoAprovarPortal(token))}
          className="min-h-14 flex-1 rounded-lg bg-ambar-500 px-6 font-body text-base font-semibold text-tinta-900 transition-colors hover:bg-ambar-600 disabled:opacity-50"
        >
          {pendente ? "Enviando…" : "Aprovar orçamento"}
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => decidir(() => acaoRecusarPortal(token))}
          className="min-h-14 flex-1 rounded-lg border border-osso-200 px-6 font-body text-base font-semibold text-tinta-900 transition-colors hover:bg-osso-100 disabled:opacity-50"
        >
          Recusar
        </button>
      </div>
      {erro ? (
        <p role="alert" className="font-body text-sm text-sinal-vermelho">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
