import Link from "next/link";
import type { Metadata } from "next";
import { FormCriarConta } from "./form";

export const metadata: Metadata = {
  title: "Criar conta — Igni",
};

export default function CriarContaPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-grafite-900 px-4 py-10">
      <div className="w-full max-w-md">
        <span className="font-display text-3xl font-bold tracking-tight text-ambar-500">IGNI</span>
        <h1 className="mt-5 font-display text-2xl text-aco-100">Crie a conta da sua oficina</h1>
        <p className="mt-1 mb-6 font-body text-sm text-aco-400">
          Escolha o seu ramo e o sistema já vem com as estações do seu mundo.
        </p>

        <FormCriarConta />

        <p className="mt-6 text-center font-body text-sm text-aco-400">
          Já tem conta?{" "}
          <Link href="/login" className="text-ambar-500 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
