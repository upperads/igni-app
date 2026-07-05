"use client";

import { RealtimePainel } from "@/app/_components/realtime-painel";
import type { DadosTv } from "@/infra/composition/tela";
import { OsCard } from "@/ui/components/os-card";
import { Relogio } from "@/ui/components/relogio";
import { RiskRail } from "@/ui/components/risk-rail";

/**
 * Board read-only da TV do setor (público, sem sessão — o token é a credencial). Espelha o visual do
 * /painel/tv (modo TV logado), mas é ESCOPO MÍNIMO: só exibe — nenhum botão de ação, nenhum link de
 * navegação, nenhum dado de dinheiro/cliente/placa. Assina o realtime e reidrata via router.refresh.
 */
export function TvBoard({ dados, titulo }: { dados: DadosTv; titulo: string }) {
  const { kpis, etapas, tenantId } = dados;
  const alarme = kpis.paradaCritica > 0 || kpis.atraso.total > 0;

  return (
    <div className="flex min-h-dvh flex-col bg-grafite-900">
      <RiskRail alarme={alarme} />
      <header className="flex items-center justify-between gap-4 border-b border-grafite-700 px-6 py-4">
        <div className="flex items-baseline gap-4">
          <span className="font-display text-2xl font-bold tracking-tight text-ambar-500">IGNI</span>
          <span className="font-mono text-sm uppercase tracking-widest text-aco-300">{titulo}</span>
        </div>
        <div className="flex items-center gap-5">
          <RealtimePainel tenantId={tenantId} />
          <Relogio className="font-mono text-2xl tabular-nums text-aco-100" />
        </div>
      </header>
      <main className="flex-1 px-6 py-6">
        {etapas.length === 0 ? (
          <div className="grid h-full place-items-center">
            <p className="font-display text-2xl text-aco-300">Nenhum serviço aqui agora.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {etapas.map((etapa) => (
              <section key={etapa.estado} aria-label={`Etapa ${etapa.rotulo}`}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="font-display text-2xl text-aco-100">{etapa.rotulo}</h2>
                  <span className="font-mono text-sm text-aco-400">{etapa.cards.length}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {etapa.cards.map((card) => (
                    <OsCard
                      key={card.id}
                      codigo={card.codigo}
                      equipamento={card.equipamento}
                      responsavel={card.responsavel}
                      prazo={card.prazoLabel}
                      sinal={card.sinal}
                      travado={card.travado}
                      responsabilidade={card.travamentoResponsabilidade}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
