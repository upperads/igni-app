import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { pode } from "@/domain/auth/rbac";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarEstacoesNoTenant } from "@/infra/composition/config";
import { listarTelasNoTenant } from "@/infra/composition/tela";
import { AppShell } from "@/ui/components/app-shell";
import { CabecalhoTela } from "@/ui/components/cabecalho-tela";
import { PainelTelas } from "./painel-telas";

export const metadata: Metadata = {
  title: "Telas — Igni",
};

export default async function TelasPage() {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }
  // Configuração da oficina é coisa de gestão; produção e recepção não trocam o que a TV mostra.
  if (!pode(sessao.permissoes, "config:editar")) {
    redirect("/");
  }

  const [telas, estacoes] = await Promise.all([
    listarTelasNoTenant(sessao),
    listarEstacoesNoTenant(sessao),
  ]);

  return (
    <AppShell>
      <CabecalhoTela
        etiqueta="Configuração"
        titulo="Telas"
        sub="Cadastre as TVs dos setores e troque daqui o que cada uma mostra. A TV obedece na hora — sem ninguém ir até ela."
      />
      <div className="max-w-2xl">
        <PainelTelas telas={telas} estacoes={estacoes.map((e) => ({ id: e.id, nome: e.nome }))} />
      </div>
    </AppShell>
  );
}
