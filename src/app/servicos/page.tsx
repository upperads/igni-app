import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { pode } from "@/domain/auth/rbac";
import { sessaoAtual } from "@/infra/auth/sessao";
import { listarServicosNoTenant } from "@/infra/composition/servico";
import { AppShell } from "@/ui/components/app-shell";
import { CabecalhoTela } from "@/ui/components/cabecalho-tela";
import { EditorServicos } from "./editor-servicos";

export const metadata: Metadata = {
  title: "Serviços — Igni",
};

export default async function ServicosPage() {
  const sessao = await sessaoAtual();
  if (!sessao) {
    redirect("/login");
  }
  // O catálogo é gerido por quem edita orçamento — dono/gestor/recepção; produção não entra aqui.
  if (!pode(sessao.papel, "orcamento:editar")) {
    redirect("/");
  }
  const servicos = await listarServicosNoTenant(sessao, { incluirInativos: true });

  return (
    <AppShell>
      <CabecalhoTela
        etiqueta="Cadastro"
        titulo="Serviços"
        sub="Sua tabela de preços. Cadastre os serviços que a oficina faz e o preço de cada um — no orçamento, é só escolher em vez de digitar tudo de novo."
      />
      <div className="max-w-3xl">
        <EditorServicos servicos={servicos} />
      </div>
    </AppShell>
  );
}
