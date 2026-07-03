"use client";

import { useEffect, useRef, useState } from "react";
import { acaoReajustar } from "./actions";

interface Props {
  onFechar: () => void;
}

/**
 * Reajuste em massa: pede o percentual, confirma o impacto antes de aplicar (não some com o preço de
 * ninguém sem aviso) e mostra o resultado. Fecha no Escape — mesma a11y do modal de aprovação da OS.
 */
export function ReajusteModal({ onFechar }: Props) {
  const [pct, setPct] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<number | null>(null);
  const primeiroRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    primeiroRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onFechar();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onFechar]);

  const pctNumero = Number.parseInt(pct, 10);
  const pctValido = pct.trim() !== "" && Number.isInteger(pctNumero);

  async function confirmar() {
    setErro(null);
    setPendente(true);
    const r = await acaoReajustar(pct);
    setPendente(false);
    if (!r.ok) {
      setErro(r.motivo ?? "Não foi possível reajustar.");
      setConfirmando(false);
      return;
    }
    setResultado(r.afetados ?? 0);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reajustar preços em massa"
      className="fixed inset-0 z-50 grid place-items-center bg-grafite-900/80 p-4"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-grafite-600 bg-grafite-850 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {resultado !== null ? (
          <>
            <h2 className="font-display text-lg text-aco-100">Pronto</h2>
            <p className="mt-2 font-body text-sm text-aco-100">
              {resultado} {resultado === 1 ? "serviço reajustado" : "serviços reajustados"}.
            </p>
            <button
              type="button"
              onClick={onFechar}
              className="mt-4 w-full rounded-md bg-ambar-500 px-4 py-2 font-display text-sm font-bold text-grafite-900 transition-colors hover:bg-ambar-600"
            >
              Fechar
            </button>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg text-aco-100">Reajustar todos os preços</h2>
            <p className="mt-1 font-body text-sm text-aco-400">
              Aplica o percentual sobre o valor de todos os serviços ativos do catálogo. Use negativo
              para desconto.
            </p>

            <label className="mt-4 block font-mono text-[11px] uppercase tracking-wide text-aco-400">
              Percentual
              <input
                ref={primeiroRef}
                type="number"
                step={1}
                inputMode="numeric"
                value={pct}
                onChange={(ev) => {
                  setPct(ev.target.value);
                  setConfirmando(false);
                }}
                placeholder="ex.: 10 ou -5"
                className="mt-1 w-full rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
              />
            </label>

            {confirmando && pctValido ? (
              <p role="alert" className="mt-3 font-body text-sm text-ambar-500">
                Vai mudar os preços de todos os serviços ativos em {pctNumero > 0 ? "+" : ""}
                {pctNumero}%. Confirmar?
              </p>
            ) : null}

            {erro ? (
              <p role="alert" className="mt-3 font-body text-sm text-sinal-vermelho">
                {erro}
              </p>
            ) : null}

            <div className="mt-4 flex gap-2">
              {confirmando ? (
                <>
                  <button
                    type="button"
                    onClick={confirmar}
                    disabled={pendente || !pctValido}
                    className="flex-1 rounded-md bg-sinal-vermelho px-4 py-2 font-display text-sm font-bold text-grafite-900 transition-colors disabled:opacity-50"
                  >
                    {pendente ? "Aplicando…" : "Confirmar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    disabled={pendente}
                    className="rounded-md px-4 py-2 font-body text-sm text-aco-400 hover:text-aco-100"
                  >
                    Voltar
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmando(true)}
                    disabled={!pctValido}
                    className="flex-1 rounded-md bg-ambar-500 px-4 py-2 font-display text-sm font-bold text-grafite-900 transition-colors hover:bg-ambar-600 disabled:opacity-50"
                  >
                    Reajustar
                  </button>
                  <button
                    type="button"
                    onClick={onFechar}
                    className="rounded-md px-4 py-2 font-body text-sm text-aco-400 hover:text-aco-100"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
