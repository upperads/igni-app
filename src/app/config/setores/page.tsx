import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { pode } from "@/domain/auth/rbac";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarSetoresComEstacoesNoTenant } from "@/infra/composition/setor";
import { AppShell } from "@/ui/components/app-shell";
import { CabecalhoTela } from "@/ui/components/cabecalho-tela";
import { PainelSetores } from "./painel-setores";

export const metadata: Metadata = {
  title: "Setores — Igni",
};

export default async function SetoresPage() {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }
  if (!pode(sessao.permissoes, "config:editar")) {
    redirect("/");
  }
  const setores = await listarSetoresComEstacoesNoTenant(sessao);
  return (
    <AppShell>
      <CabecalhoTela
        etiqueta="Chão"
        titulo="Setores"
        sub="Agrupe as estações nos setores físicos da oficina (Usinagem, Montagem…). A TV mostra um setor inteiro. Mova estações entre setores; crie e reordene os setores."
      />
      <PainelSetores setores={setores} />
    </AppShell>
  );
}
