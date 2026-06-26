import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { sessaoAtual } from "@/infra/auth/sessao";
import { AppShell } from "@/ui/components/app-shell";
import { CabecalhoTela } from "@/ui/components/cabecalho-tela";
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

      <CabecalhoTela
        etiqueta="Recepção"
        titulo="Abrir OS"
        sub="Registre quem trouxe, o quê e como entrou. A OS nasce no estado Aberta e segue daqui pela linha de produção."
      />

      <div className="max-w-2xl">
        <FormAbrirOs />
      </div>
    </AppShell>
  );
}
