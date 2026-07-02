import { headers } from "next/headers";
import type { Metadata } from "next";
import { dadosQuiosque } from "@/infra/composition/quiosque";
import { dentroDoLimite } from "@/infra/rate-limit";
import { QuiosqueChao } from "./quiosque-chao";

export const metadata: Metadata = {
  title: "Quiosque — Igni",
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
 * Tela do tablet no chão do setor (público, sem sessão — o token/código é a credencial, mesmo padrão
 * do portal, ADR-012). Sem AppShell, sem menu: só os cards do setor do quiosque e o botão de bump.
 */
export default async function QuiosquePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Rate-limit por IP: o parâmetro pode ser um CÓDIGO CURTO (adivinhável). Se o limite fosse só por
  // token, cada código chutado teria seu próprio balde e a enumeração passaria livre. O IP (que o
  // atacante não escolhe) é a chave que barra a varredura de "BLOCO-XXXX". O por-token fica como
  // proteção adicional contra um cliente legítimo recarregando demais.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const muitas =
    !dentroDoLimite(`quiosque-view-ip:${ip}`, { limite: 40, janelaMs: 60_000 }) ||
    !dentroDoLimite(`quiosque-view:${token}`, { limite: 120, janelaMs: 60_000 });
  if (muitas) {
    return (
      <Moldura>
        <h1 className="font-display text-2xl text-aco-100">Muitas tentativas</h1>
        <p className="font-body text-aco-300">Aguarde um instante e atualize a página.</p>
      </Moldura>
    );
  }

  const dados = await dadosQuiosque(token);
  if (!dados) {
    return (
      <Moldura>
        <h1 className="font-display text-2xl text-aco-100">Quiosque desligado</h1>
        <p className="font-body text-aco-300">Peça um novo ao escritório.</p>
      </Moldura>
    );
  }

  return <QuiosqueChao estacaoNome={dados.estacaoNome} cards={dados.cards} token={token} />;
}
