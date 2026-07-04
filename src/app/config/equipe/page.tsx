import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { pode } from "@/domain/auth/rbac";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarCargosNoTenant } from "@/infra/composition/cargo";
import { listarEquipeNoTenant } from "@/infra/composition/equipe";
import { AppShell } from "@/ui/components/app-shell";
import { CabecalhoTela } from "@/ui/components/cabecalho-tela";
import { PainelEquipe } from "./painel-equipe";

export const metadata: Metadata = {
  title: "Equipe — Igni",
};

export default async function EquipePage() {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }
  // Gerir equipe é administração: só dono/gestor.
  if (!pode(sessao.permissoes, "equipe:gerir")) {
    redirect("/");
  }

  const [equipe, cargosTenant] = await Promise.all([
    listarEquipeNoTenant(sessao),
    listarCargosNoTenant(sessao),
  ]);
  const cargos = cargosTenant.map((c) => ({ id: c.id, nome: c.nome }));

  return (
    <AppShell>
      <CabecalhoTela
        etiqueta="Configuração"
        titulo="Equipe"
        sub="Quem usa o Igni na sua oficina. Convide a recepção e o pessoal do chão — é com eles na mão que o sistema vira rotina, e cada toque deles vira o seu relatório."
      />
      <div className="max-w-2xl">
        <PainelEquipe equipe={equipe} meuId={sessao.usuarioId} cargos={cargos} />
      </div>
    </AppShell>
  );
}
