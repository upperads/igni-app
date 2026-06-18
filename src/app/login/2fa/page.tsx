import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verificação em duas etapas — Igni",
};

export default function DoisFatoresPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-grafite-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <span className="font-display text-3xl font-bold tracking-tight text-ambar-500">IGNI</span>
        <h1 className="mt-5 font-display text-2xl text-aco-100">Verificação em duas etapas</h1>
        <p className="mt-2 font-body text-sm text-aco-400">
          Seu perfil é administrativo, então o acesso exige um segundo fator (código TOTP).
        </p>
        <div className="mt-4 rounded-md border border-ambar-600/50 bg-grafite-800 p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-ambar-500">Em construção</p>
          <p className="mt-1 font-body text-sm text-aco-200">
            A senha já foi verificada. O cadastro e a verificação do TOTP entram na próxima fatia.
          </p>
        </div>
      </div>
    </main>
  );
}
