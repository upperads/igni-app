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
        <h1 className="mt-5 font-display text-2xl text-aco-100">Entrar</h1>
        <p className="mt-1 mb-6 font-body text-sm text-aco-400">Acesse o painel da sua oficina.</p>
        <FormLogin />
      </div>
    </main>
  );
}
