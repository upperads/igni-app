import Link from "next/link";
import type { Metadata } from "next";
import { FormRecuperar } from "./form";

export const metadata: Metadata = {
  title: "Recuperar senha — Igni",
};

export default function RecuperarPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-grafite-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <span className="font-display text-3xl font-bold tracking-tight text-ambar-500">IGNI</span>
        <h1 className="mt-5 font-display text-2xl text-aco-100">Recuperar senha</h1>
        <p className="mt-1 mb-6 font-body text-sm text-aco-400">
          Informe o seu e-mail e enviaremos um link para você escolher uma nova senha.
        </p>

        <FormRecuperar />

        <p className="mt-6 text-center font-body text-sm text-aco-400">
          <Link href="/login" className="text-ambar-500 hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </main>
  );
}
