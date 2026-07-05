import { headers } from "next/headers";
import type { Metadata } from "next";
import { dadosTv } from "@/infra/composition/tela";
import { dentroDoLimite } from "@/infra/rate-limit";
import { TvBoard } from "./tv-board";

export const metadata: Metadata = {
  title: "Painel — Igni (TV)",
};

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-grafite-900 px-5 py-10">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <span className="font-display text-2xl font-bold tracking-tight text-ambar-500">IGNI</span>
        {children}
      </div>
    </main>
  );
}

/**
 * TV do setor (público, sem sessão — o token OU código curto é a credencial, P-3). Read-only,
 * controlada pelo escritório: sem avançar OS, sem dinheiro/cliente/placa, sem navegação.
 */
export default async function TvPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const muitas =
    !dentroDoLimite(`tv-view-ip:${ip}`, { limite: 40, janelaMs: 60_000 }) ||
    !dentroDoLimite(`tv-view:${token}`, { limite: 120, janelaMs: 60_000 });
  if (muitas) {
    return (
      <Moldura>
        <h1 className="font-display text-2xl text-aco-100">Muitas tentativas</h1>
        <p className="font-body text-aco-300">Aguarde um instante e atualize a página.</p>
      </Moldura>
    );
  }

  const dados = await dadosTv(token);
  if (!dados) {
    return (
      <Moldura>
        <h1 className="font-display text-2xl text-aco-100">Tela desconectada</h1>
        <p className="font-body text-aco-300">Esta tela foi desligada. Fale com o escritório.</p>
      </Moldura>
    );
  }

  const titulo = dados.modo === "geral" ? "Visão geral" : (dados.estacaoNome ?? "Setor");
  return <TvBoard dados={dados} titulo={titulo} />;
}
