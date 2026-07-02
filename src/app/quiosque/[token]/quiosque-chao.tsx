"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EstadoOS } from "@/domain/os/estado";
import { rotuloEstado } from "@/domain/os/estado";
import { acaoBumpQuiosque } from "./actions";

export interface CardQuiosqueView {
  id: string;
  numero: number;
  equipamento: string;
  estado: EstadoOS;
  proximoBump: EstadoOS | null;
  travado: boolean;
}

/**
 * Tela de chão do quiosque (tablet fixo no setor). Cards grandes, sem menu, sem AppShell — só o que
 * o setor precisa ver. "PRONTO →" abre um teclado numérico de 4 dígitos (alvo grande, uso com luva).
 */
export function QuiosqueChao({
  estacaoNome,
  cards,
  token,
}: {
  estacaoNome: string;
  cards: CardQuiosqueView[];
  token: string;
}) {
  const [alvo, setAlvo] = useState<CardQuiosqueView | null>(null);

  return (
    <div className="flex min-h-dvh flex-col bg-grafite-900">
      <header className="flex items-center justify-between gap-4 border-b border-grafite-700 px-5 py-4">
        <span className="font-display text-2xl font-bold tracking-tight text-ambar-500">IGNI</span>
        <span className="font-mono text-sm uppercase tracking-widest text-aco-300">{estacaoNome}</span>
      </header>

      <main className="flex-1 px-5 py-6">
        {cards.length === 0 ? (
          <div className="grid h-full place-items-center">
            <p className="font-display text-2xl text-aco-300">Nada neste setor agora.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <article
                key={card.id}
                className="flex flex-col gap-3 rounded-xl border border-grafite-700 bg-grafite-800 p-5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-sm text-aco-400">OS-{card.numero}</span>
                  <span className="font-mono text-xs uppercase tracking-wide text-aco-500">
                    {rotuloEstado(card.estado)}
                  </span>
                </div>
                <p className="font-display text-2xl leading-tight text-aco-100">{card.equipamento}</p>
                {card.travado ? (
                  <p className="font-mono text-sm uppercase tracking-wide text-ambar-500">⏸ Travado</p>
                ) : null}
                <div className="mt-auto pt-1">
                  {card.proximoBump ? (
                    <button
                      type="button"
                      onClick={() => setAlvo(card)}
                      className="min-h-20 w-full rounded-lg bg-ambar-500 px-4 font-display text-2xl font-bold tracking-wide text-grafite-900 transition-colors hover:bg-ambar-600 active:scale-[0.99]"
                    >
                      {`PRONTO → ${rotuloEstado(card.proximoBump)}`}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {alvo ? (
        <TecladoPin
          card={alvo}
          token={token}
          onFechar={() => setAlvo(null)}
        />
      ) : null}
    </div>
  );
}

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "apagar", "0", "ok"] as const;

function TecladoPin({
  card,
  token,
  onFechar,
}: {
  card: CardQuiosqueView;
  token: string;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onFechar();
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  function digitar(tecla: (typeof TECLAS)[number]) {
    if (pendente || feito) {
      return;
    }
    if (tecla === "apagar") {
      setErro(null);
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (tecla === "ok") {
      return;
    }
    if (pin.length >= 4) {
      return;
    }
    const novoPin = pin + tecla;
    setErro(null);
    setPin(novoPin);
    if (novoPin.length === 4 && card.proximoBump) {
      const proximo = card.proximoBump;
      iniciar(async () => {
        const r = await acaoBumpQuiosque(token, card.id, proximo, novoPin);
        if (!r.ok) {
          setErro(r.motivo ?? "PIN não confere.");
          setPin("");
          return;
        }
        setFeito(true);
        router.refresh();
      });
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`PIN para avançar OS-${card.numero}`}
      className="fixed inset-0 z-50 grid place-items-center bg-grafite-900/95 px-5"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="text-center">
          <p className="font-mono text-sm uppercase tracking-widest text-aco-400">
            OS-{card.numero} · {card.equipamento}
          </p>
          <p className="mt-1 font-display text-xl text-aco-100">
            {card.proximoBump ? `Confirmar: ${rotuloEstado(card.proximoBump)}` : "Confirmar"}
          </p>
        </div>

        {feito ? (
          <p className="font-display text-3xl text-sinal-verde">Feito ✓</p>
        ) : (
          <>
            <div className="flex gap-3" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={
                    i < pin.length
                      ? "h-4 w-4 rounded-full bg-ambar-500"
                      : "h-4 w-4 rounded-full border border-grafite-600"
                  }
                />
              ))}
            </div>

            <div className="grid w-full grid-cols-3 gap-3">
              {TECLAS.map((tecla) => {
                if (tecla === "ok") {
                  return <span key="ok" aria-hidden />;
                }
                return (
                  <button
                    key={tecla}
                    type="button"
                    disabled={pendente}
                    onClick={() => digitar(tecla)}
                    aria-label={tecla === "apagar" ? "Apagar" : tecla}
                    className="min-h-20 rounded-lg border border-grafite-600 bg-grafite-800 font-display text-2xl text-aco-100 transition-colors hover:bg-grafite-700 disabled:opacity-60"
                  >
                    {tecla === "apagar" ? "←" : tecla}
                  </button>
                );
              })}
            </div>

            {erro ? (
              <p role="alert" className="font-body text-base text-sinal-vermelho">
                {erro}
              </p>
            ) : null}
          </>
        )}

        <button
          type="button"
          onClick={onFechar}
          className="min-h-14 w-full rounded-lg border border-grafite-600 px-6 font-body text-base text-aco-300 transition-colors hover:text-aco-100"
        >
          {feito ? "Fechar" : "Cancelar"}
        </button>
      </div>
    </div>
  );
}
