import type { Metadata } from "next";
import { EntrarQuiosque } from "./entrar-quiosque";

export const metadata: Metadata = {
  title: "Entrar no quiosque — Igni",
};

/** Entrada por código curto: atalho de backup quando o QR do tablet não está à mão. */
export default function EntrarQuiosquePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-grafite-900 px-5 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <span className="font-display text-2xl font-bold tracking-tight text-ambar-500">IGNI</span>
        <div>
          <h1 className="font-display text-2xl text-aco-100">Entrar no quiosque</h1>
          <p className="mt-1 font-body text-sm text-aco-400">
            Digite o código curto que o escritório passou para este setor.
          </p>
        </div>
        <EntrarQuiosque />
      </div>
    </main>
  );
}
