import Link from "next/link";
import type { Metadata } from "next";
import { FormAtualizarSenha } from "./form";

export const metadata: Metadata = {
  title: "Nova senha — Igni",
};

export default function AtualizarSenhaPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-grafite-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <span className="font-display text-3xl font-bold tracking-tight text-ambar-500">IGNI</span>
        <h1 className="mt-5 font-display text-2xl text-aco-100">Escolha uma nova senha</h1>
        <p className="mt-1 mb-6 font-body text-sm text-aco-400">
          Defina a nova senha da sua conta. Depois disso, é só usá-la para entrar.
        </p>

        <FormAtualizarSenha />

        <p className="mt-6 font-body text-sm text-aco-400">
          <Link href="/login" className="text-ambar-500 hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </main>
  );
}
