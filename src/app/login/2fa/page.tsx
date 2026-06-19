import type { Metadata } from "next";
import { DoisFatores } from "./dois-fatores";

export const metadata: Metadata = {
  title: "Verificação em duas etapas — Igni",
};

export default function DoisFatoresPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-grafite-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <span className="font-display text-3xl font-bold tracking-tight text-ambar-500">IGNI</span>
        <h1 className="mt-5 font-display text-2xl text-aco-100">Verificação em duas etapas</h1>
        <p className="mt-1 mb-6 font-body text-sm text-aco-400">
          Seu perfil é administrativo, então o acesso exige um segundo fator.
        </p>
        <DoisFatores />
      </div>
    </main>
  );
}
