"use client";

import { useState } from "react";
import { ROTULO_TIPO_ITEM, TIPOS_ITEM } from "@/domain/orcamento/orcamento";
import type { ServicoView } from "@/infra/composition/servico";

/** Converte centavos → string de reais no formato do input do builder ("1234" centavos → "12,34"). */
function centavosParaReais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

/**
 * Seletor "Do catálogo": lista os serviços ATIVOS agrupados por tipo; escolher um chama `onEscolher`
 * com os dados prontos para virar uma LINHA do builder (o preço é sugestão — a linha fica editável).
 */
export function SeletorCatalogo({
  servicos,
  onEscolher,
  onFechar,
}: {
  servicos: ServicoView[];
  onEscolher: (item: { tipo: string; descricao: string; valor: string; markup: string }) => void;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const filtro = busca.trim().toLowerCase();
  const visiveis = servicos.filter((s) => s.ativo && s.nome.toLowerCase().includes(filtro));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Escolher do catálogo"
      className="fixed inset-0 z-50 grid place-items-center bg-grafite-900/80 p-4"
      onClick={onFechar}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-grafite-600 bg-grafite-850 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg text-aco-100">Do catálogo</h2>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar serviço"
          placeholder="Buscar serviço"
          className="mt-3 rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
        />
        <div className="mt-3 flex-1 overflow-y-auto">
          {visiveis.length === 0 ? (
            <p className="py-6 text-center font-body text-sm text-aco-400">
              Nenhum serviço no catálogo. Cadastre em Serviços.
            </p>
          ) : (
            TIPOS_ITEM.map((tipo) => {
              const doTipo = visiveis.filter((s) => s.tipo === tipo);
              if (doTipo.length === 0) return null;
              return (
                <div key={tipo} className="mb-3">
                  <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-aco-400">
                    {ROTULO_TIPO_ITEM[tipo]}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {doTipo.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() =>
                            onEscolher({
                              tipo: s.tipo,
                              descricao: s.nome,
                              valor: centavosParaReais(s.valorCentavos),
                              markup: String(s.markupPct),
                            })
                          }
                          className="flex w-full items-center justify-between gap-3 rounded-md border border-grafite-700 bg-grafite-800 px-3 py-2 text-left font-body text-sm text-aco-100 transition-colors hover:border-ambar-500"
                        >
                          <span>
                            {s.nome}
                            {s.markupPct > 0 ? (
                              <span className="ml-1 font-mono text-xs text-aco-400">+{s.markupPct}%</span>
                            ) : null}
                          </span>
                          <span className="font-mono tabular-nums text-aco-300">
                            {(s.valorCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="mt-4 rounded-md px-4 py-2 font-body text-sm text-aco-400 hover:text-aco-100"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
