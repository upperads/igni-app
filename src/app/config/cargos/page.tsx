import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarCargosNoTenant } from "@/infra/composition/cargo";
import { AppShell } from "@/ui/components/app-shell";
import { CabecalhoTela } from "@/ui/components/cabecalho-tela";
import { EditorCargos } from "./editor-cargos";

export const metadata: Metadata = {
  title: "Cargos — Igni",
};

export default async function CargosPage() {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }
  // Gerir cargos é exclusivo do Dono (cargo:gerir implícito).
  if (!sessao.podeGerirCargos) {
    redirect("/");
  }
  const cargos = await listarCargosNoTenant(sessao);
  return (
    <AppShell>
      <CabecalhoTela
        etiqueta="Configuração"
        titulo="Cargos"
        sub="Defina as funções da sua equipe e o que cada uma vê e faz. Cargos de sistema têm permissões fixas — você pode renomear. Crie cargos próprios com as permissões que fizerem sentido."
      />
      <div className="max-w-2xl">
        <EditorCargos cargos={cargos} />
      </div>
    </AppShell>
  );
}
