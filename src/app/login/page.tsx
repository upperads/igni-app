import type { Metadata } from "next";
import { FormLogin } from "./form";

export const metadata: Metadata = {
  title: "Entrar — Igni",
};

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-grafite-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <span className="font-display text-3xl font-bold tracking-tight text-ambar-500">IGNI</span>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-aco-400">
          Painel da oficina
        </p>
        <h1 className="mt-1 font-display text-2xl text-aco-100">Entrar</h1>
        <p className="mt-1 mb-6 font-body text-sm text-aco-400">
          O sistema operacional do seu chão. Honesto sobre o atraso.
        </p>
        <FormLogin />
      </div>
    </main>
  );
}
