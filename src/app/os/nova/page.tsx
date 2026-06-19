import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { sessaoAtual } from "@/infra/auth/sessao";
import { AppShell } from "@/ui/components/app-shell";
import { FormAbrirOs } from "./form";

export const metadata: Metadata = {
  title: "Abrir OS — Igni",
};

export default async function NovaOsPage() {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }

  return (
    <AppShell>
      <div className="mb-2">
        <Link href="/os" className="font-mono text-xs text-aco-400 hover:text-ambar-500">
          ← Ordens de serviço
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-aco-100">Abrir OS</h1>
        <p className="mt-1 max-w-prose font-body text-sm text-aco-400">
          Registre quem trouxe, o quê e como entrou. A OS nasce no estado{" "}
          <span className="text-aco-200">Aberta</span> e segue daqui pela linha de produção.
        </p>
      </div>

      <div className="max-w-2xl">
        <FormAbrirOs />
      </div>
    </AppShell>
  );
}
