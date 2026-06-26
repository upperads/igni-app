"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ROTULO_TIPO_ITEM, type StatusOrcamento, TIPOS_ITEM } from "@/domain/orcamento/orcamento";
import type { OrcamentoView } from "@/infra/composition/os";
import {
  acaoAprovarOrcamento,
  acaoEnviarOrcamento,
  acaoMontarOrcamento,
  acaoReabrirOrcamento,
  acaoRecusarOrcamento,
  type ItemFormulario,
} from "../actions";
import { Button } from "@/ui/components/button";
import { INPUT_CLASS, LABEL_CLASS } from "@/ui/components/text-field";

const STATUS_ROTULO: Record<StatusOrcamento, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado ao cliente",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (centavos: number) => moeda.format(centavos / 100);

function centavosPreview(valor: string, markup: string): number {
  const v = Number.parseFloat(valor.replace(",", "."));
  const m = Number.parseInt(markup || "0", 10);
  if (!Number.isFinite(v) || v < 0) {
    return 0;
  }
  const base = Math.round(v * 100);
  const pct = Number.isInteger(m) && m > 0 ? m : 0;
  return base + Math.round((base * pct) / 100);
}

const LINHA_VAZIA: ItemFormulario = { tipo: "peca", descricao: "", valor: "", markup: "0" };

interface Props {
  osId: string;
  estado: string;
  cqAprovado: boolean;
  orcamento: OrcamentoView | null;
  podeEditar: boolean;
}

export function Orcamento({ osId, orcamento, podeEditar }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const status: StatusOrcamento = orcamento?.status ?? "rascunho";
  const editavel = podeEditar && status === "rascunho";

  const [linhas, setLinhas] = useState<ItemFormulario[]>(() =>
    orcamento && orcamento.itens.length > 0
      ? orcamento.itens.map((i) => ({
          tipo: i.tipo,
          descricao: i.descricao,
          valor: (i.valorCentavos / 100).toFixed(2).replace(".", ","),
          markup: String(i.markupPct),
        }))
      : [{ ...LINHA_VAZIA }],
  );

  const totalPreview = linhas.reduce((s, l) => s + centavosPreview(l.valor, l.markup), 0);

  function rodar(acao: () => Promise<{ ok: boolean; motivo?: string; token?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) {
        setErro(r.motivo ?? "Não foi possível concluir.");
        return;
      }
      if (r.token) {
        setLink(`${window.location.origin}/portal/${r.token}`);
      }
      router.refresh();
    });
  }

  function alterar(i: number, campo: keyof ItemFormulario, valor: string) {
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  }

  // --- Leitura (status decidido ou papel sem permissão) ---
  if (!editavel) {
    return (
      <div className="rounded-md border border-grafite-700 bg-grafite-800 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="font-mono text-xs uppercase tracking-wide text-aco-400">
            {STATUS_ROTULO[status]}
          </span>
          {orcamento ? (
            <span className="font-mono text-sm tabular-nums text-aco-100">
              {fmt(orcamento.totais.total)}
            </span>
          ) : null}
        </div>

        {orcamento && orcamento.itens.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {orcamento.itens.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-aco-200">
                  <span className="font-mono text-xs text-aco-400">{ROTULO_TIPO_ITEM[i.tipo]}</span>{" "}
                  {i.descricao}
                  {i.markupPct > 0 ? ` (+${i.markupPct}%)` : ""}
                </span>
                <span className="font-mono tabular-nums text-aco-100">{fmt(i.totalCentavos)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-body text-sm text-aco-400">Sem orçamento ainda.</p>
        )}

        {podeEditar && status === "enviado" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={pendente} onClick={() => rodar(() => acaoAprovarOrcamento(osId))}>
              Aprovar
            </Button>
            <Button
              variante="fantasma"
              disabled={pendente}
              onClick={() => rodar(() => acaoRecusarOrcamento(osId))}
            >
              Recusar
            </Button>
          </div>
        ) : null}

        {podeEditar && status === "recusado" ? (
          <Button
            variante="fantasma"
            disabled={pendente}
            onClick={() => rodar(() => acaoReabrirOrcamento(osId))}
            className="mt-4"
          >
            Reabrir para renegociar
          </Button>
        ) : null}

        {erro ? <p role="alert" className="mt-3 font-body text-sm text-sinal-vermelho">{erro}</p> : null}
      </div>
    );
  }

  // --- Edição (rascunho + permissão) ---
  return (
    <div className="rounded-md border border-grafite-700 bg-grafite-800 p-4">
      <div className="flex flex-col gap-3">
        {linhas.map((l, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[8rem_1fr_7rem_5rem_auto]">
            <select
              aria-label="Tipo do item"
              value={l.tipo}
              onChange={(e) => alterar(i, "tipo", e.target.value)}
              className={INPUT_CLASS}
            >
              {TIPOS_ITEM.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO_ITEM[t]}
                </option>
              ))}
            </select>
            <input
              aria-label="Descrição"
              value={l.descricao}
              onChange={(e) => alterar(i, "descricao", e.target.value)}
              placeholder="Descrição"
              className={INPUT_CLASS}
            />
            <input
              aria-label="Valor em reais"
              value={l.valor}
              onChange={(e) => alterar(i, "valor", e.target.value)}
              inputMode="decimal"
              placeholder="R$"
              className={INPUT_CLASS}
            />
            <input
              aria-label="Markup percentual"
              value={l.markup}
              onChange={(e) => alterar(i, "markup", e.target.value)}
              inputMode="numeric"
              placeholder="%"
              className={INPUT_CLASS}
            />
            <button
              type="button"
              aria-label="Remover item"
              onClick={() => setLinhas((ls) => ls.filter((_, idx) => idx !== i))}
              className="min-h-12 rounded-md border border-grafite-600 px-3 font-mono text-sm text-aco-400 hover:text-sinal-vermelho"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setLinhas((ls) => [...ls, { ...LINHA_VAZIA }])}
        className="mt-3 font-mono text-sm text-ambar-500 hover:underline"
      >
        + Adicionar item
      </button>

      <div className="mt-4 flex items-center justify-between border-t border-grafite-700 pt-3">
        <span className={LABEL_CLASS}>Total (prévia)</span>
        <span className="font-mono text-lg tabular-nums text-aco-100">{fmt(totalPreview)}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={pendente}
          onClick={() =>
            rodar(() =>
              acaoMontarOrcamento(
                osId,
                linhas.filter((l) => l.descricao.trim() !== ""),
              ),
            )
          }
        >
          Salvar
        </Button>
        {orcamento && orcamento.itens.length > 0 ? (
          <Button
            variante="fantasma"
            disabled={pendente}
            onClick={() => rodar(() => acaoEnviarOrcamento(osId))}
          >
            Enviar ao cliente
          </Button>
        ) : null}
      </div>

      {link ? (
        <div className="mt-3 rounded-md border border-grafite-700 bg-grafite-850 p-3">
          <p className="font-mono text-xs uppercase tracking-wide text-aco-400">Link do cliente</p>
          <code className="font-mono text-xs break-all text-ambar-500">{link}</code>
          <p className="mt-1 font-body text-xs text-aco-400">
            Mande este link ao cliente: ele vê o estágio e aprova ou recusa o orçamento por aqui.
          </p>
        </div>
      ) : null}

      {erro ? <p role="alert" className="mt-3 font-body text-sm text-sinal-vermelho">{erro}</p> : null}
    </div>
  );
}
