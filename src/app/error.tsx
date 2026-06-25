"use client";

import { useEffect } from "react";
import { Button } from "@/ui/components/button";

/**
 * Fronteira de erro raiz (board escuro). Não vaza stack trace; oferece tentar de novo. Mantém a
 * calma do capataz: diz o que houve e o caminho de volta.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // O log fica no servidor (Next reporta o digest); aqui não expomos detalhe ao operador.
  }, []);

  return (
    <div className="grid min-h-dvh place-items-center bg-grafite-900 px-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-ambar-500">Algo travou</p>
        <h1 className="mt-3 font-display text-2xl text-aco-100">Não foi possível carregar esta tela.</h1>
        <p className="mt-2 font-body text-sm text-aco-300">
          Pode ter sido a rede do chão. O último estado segue salvo. Tente de novo.
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={() => reset()}>Tentar de novo</Button>
        </div>
      </div>
    </div>
  );
}
