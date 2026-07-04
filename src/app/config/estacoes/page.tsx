import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { pode } from "@/domain/auth/rbac";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarEstacoesNoTenant } from "@/infra/composition/config";
import { listarQuiosquesNoTenant, type QuiosqueView } from "@/infra/composition/quiosque";
import { AppShell } from "@/ui/components/app-shell";
import { CabecalhoTela } from "@/ui/components/cabecalho-tela";
import { EditorEstacoes } from "./editor-estacoes";

export const metadata: Metadata = {
  title: "Estações — Igni",
};

export default async function EstacoesPage() {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }
  // Configuração da oficina é coisa de gestão; produção e recepção não configuram estações.
  if (!pode(sessao.permissoes, "config:editar")) {
    redirect("/");
  }

  const [estacoes, quiosques] = await Promise.all([
    listarEstacoesNoTenant(sessao),
    listarQuiosquesNoTenant(sessao),
  ]);
  const quiosquePorEstacao: Record<string, QuiosqueView> = Object.fromEntries(
    quiosques.filter((q) => q.ativo).map((q) => [q.estacaoId, q]),
  );

  return (
    <AppShell>
      <CabecalhoTela
        etiqueta="Configuração"
        titulo="Estações"
        sub="Os postos por onde o trabalho passa no chão. Vieram do template do seu ramo — ajuste para a realidade da sua oficina: renomeie, reordene, adicione ou remova."
      />
      <div className="max-w-2xl">
        <EditorEstacoes estacoes={estacoes} quiosquePorEstacao={quiosquePorEstacao} />
      </div>
    </AppShell>
  );
}
