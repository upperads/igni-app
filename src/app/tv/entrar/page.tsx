import type { Metadata } from "next";
import { EntrarTela } from "./entrar-tela";

export const metadata: Metadata = { title: "Conectar tela — Igni" };

/** Pareamento da TV: 100% client-side, sem action — o form apenas navega para /tv/{codigo}. */
export default function EntrarTelaPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-grafite-900 px-5 py-10">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="font-display text-2xl font-bold tracking-tight text-ambar-500">IGNI</span>
        <h1 className="font-display text-2xl text-aco-100">Conectar esta TV</h1>
        <p className="font-body text-sm text-aco-300">
          Digite o código que aparece no escritório (Configurações → Telas).
        </p>
        <EntrarTela />
      </div>
    </main>
  );
}
