import { headers } from "next/headers";
import type { EstadoOS } from "@/domain/os/estado";
import { statusCliente } from "@/domain/os/status-cliente";
import { ROTULO_TIPO_ITEM } from "@/domain/orcamento/orcamento";
import { dadosPortal, type PortalView } from "@/infra/composition/portal";
import { dentroDoLimite } from "@/infra/rate-limit";
import { moeda } from "@/ui/format";
import { DecisaoPortal } from "./decisao";

const MARCOS = ["Recebido", "Orçamento", "Execução", "Pronto", "Entregue"] as const;
const MARCO_DE: Record<EstadoOS, number> = {
  aberta: 0,
  diagnostico: 0,
  orcamento: 1,
  aguardando_aprovacao: 1,
  aguardando_peca: 2,
  execucao: 2,
  controle_qualidade: 2,
  pronta: 3,
  entregue: 4,
};

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-10">
      <span className="font-display text-2xl font-bold tracking-tight text-ambar-600">IGNI</span>
      <div className="mt-8 flex-1">{children}</div>
      <p className="mt-10 font-mono text-[11px] uppercase tracking-widest text-tinta-500">
        Status do seu serviço
      </p>
    </main>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Moldura>
      <h1 className="font-display text-2xl text-tinta-900">{titulo}</h1>
      <p className="mt-2 font-body text-tinta-500">{texto}</p>
    </Moldura>
  );
}

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!dentroDoLimite(`portal-view:${ip}`, { limite: 40, janelaMs: 60_000 })) {
    return <Aviso titulo="Muitas tentativas" texto="Aguarde um instante e atualize a página." />;
  }

  const dados = await dadosPortal(token);
  if (!dados) {
    return (
      <Aviso
        titulo="Link inválido ou expirado"
        texto="Este link não está mais ativo. Peça um novo à oficina."
      />
    );
  }

  return (
    <Moldura>
      <Conteudo dados={dados} token={token} />
    </Moldura>
  );
}

function Conteudo({ dados, token }: { dados: PortalView; token: string }) {
  const marcoAtual = MARCO_DE[dados.estado];
  const status = statusCliente(dados.estado);
  const precisaAgir = status.acao !== null;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-tinta-500">
          OS-{dados.numero}
        </p>
        <h1 className="mt-1 font-display text-3xl leading-tight text-tinta-900">{dados.equipamento}</h1>
        <p className="mt-1 font-body text-sm text-tinta-500">
          {dados.clienteNome}
          {dados.placaMascarada ? ` · ${dados.placaMascarada}` : ""}
          {dados.chassiMascarado ? ` · ${dados.chassiMascarado}` : ""}
        </p>
      </header>

      {/* Stepper de cliente (régua, não bolinhas de checkout) */}
      <section aria-label="Estágio do serviço">
        <div className="flex gap-1.5">
          {MARCOS.map((_, i) => (
            <span
              key={i}
              className={
                i < marcoAtual
                  ? "h-1.5 flex-1 rounded-full bg-tinta-900"
                  : i === marcoAtual
                    ? "h-1.5 flex-1 rounded-full bg-ambar-500"
                    : "h-1.5 flex-1 rounded-full bg-osso-200"
              }
            />
          ))}
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="font-display text-lg text-tinta-900">{MARCOS[marcoAtual]}</span>
          <span className="font-mono text-xs uppercase tracking-wide text-tinta-500">
            {dados.estadoRotulo}
          </span>
        </div>
      </section>

      {/* Status do serviço — FATO, não acusação (honestidade simétrica, CDC-safe). Âmbar só quando
          depende de você (vira ação), neutro quando a oficina está trabalhando. */}
      <section
        aria-label="Status do serviço"
        className={
          precisaAgir
            ? "rounded-xl border border-ambar-600/40 bg-ambar-500/10 p-5"
            : "rounded-xl border border-osso-200 bg-osso-100 p-5"
        }
      >
        <p className="font-mono text-xs uppercase tracking-widest text-tinta-500">Status do serviço</p>
        <p className="mt-1 font-display text-2xl text-tinta-900">{status.rotulo}</p>
        <p className="mt-2 font-body text-sm text-tinta-500">{status.detalhe}</p>
      </section>

      {/* Orçamento + decisão */}
      {dados.orcamento ? (
        <section aria-label="Orçamento" className="rounded-xl border border-osso-200 bg-osso-100 p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="font-display text-lg text-tinta-900">Orçamento</span>
            <span className="font-mono text-lg tabular-nums text-tinta-900">
              {moeda(dados.orcamento.total)}
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {dados.orcamento.itens.map((i, idx) => (
              <li key={idx} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-tinta-900">
                  <span className="font-mono text-xs text-tinta-500">
                    {ROTULO_TIPO_ITEM[i.tipo]}
                  </span>{" "}
                  {i.descricao}
                </span>
                <span className="font-mono tabular-nums text-tinta-900">{moeda(i.totalCentavos)}</span>
              </li>
            ))}
          </ul>

          {dados.podeDecidir ? (
            <div className="mt-5">
              <DecisaoPortal token={token} />
            </div>
          ) : (
            <p className="mt-4 font-body text-sm text-tinta-500">
              {dados.orcamento.status === "aprovado"
                ? "Você aprovou este orçamento. O serviço segue."
                : dados.orcamento.status === "recusado"
                  ? "Você recusou este orçamento. A oficina vai renegociar."
                  : "Aguardando o orçamento."}
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
