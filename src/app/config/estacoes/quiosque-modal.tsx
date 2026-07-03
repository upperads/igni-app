"use client";

import { useEffect, useRef } from "react";

interface Props {
  estacaoNome: string;
  qrDataUrl: string;
  codigoCurto: string;
  onFechar: () => void;
}

/**
 * Mostra o QR + código curto de backup logo após ligar o quiosque de um setor. Aparece uma vez —
 * o dono aponta a câmera do tablet ou digita o código curto em /quiosque/entrar. Fecha no Escape
 * (mesmo padrão do `modal-aprovacao.tsx`).
 */
export function QuiosqueModal({ estacaoNome, qrDataUrl, codigoCurto, onFechar }: Props) {
  const fecharRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fecharRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onFechar();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onFechar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Quiosque de ${estacaoNome}`}
      className="fixed inset-0 z-50 grid place-items-center bg-grafite-900/80 p-4"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-grafite-600 bg-grafite-850 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg text-aco-100">Quiosque de {estacaoNome}</h2>
        <p className="mt-1 font-body text-sm text-aco-400">
          Aponte a câmera do tablet para o QR, ou digite o código em <span className="font-mono text-aco-300">/quiosque/entrar</span>.
        </p>

        <div className="mt-4 grid place-items-center rounded-lg bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- dataURL gerado server-side, não é asset otimizável pelo next/image */}
          <img src={qrDataUrl} alt={`QR do quiosque de ${estacaoNome}`} className="size-64" />
        </div>

        <div className="mt-4 text-center">
          <p className="font-mono text-[11px] uppercase tracking-wide text-aco-400">Código curto de backup</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-ambar-500">{codigoCurto}</p>
        </div>

        <button
          ref={fecharRef}
          type="button"
          onClick={onFechar}
          className="mt-5 w-full rounded-md bg-grafite-700 px-4 py-2 font-body text-sm text-aco-200 hover:text-aco-100"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
