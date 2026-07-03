"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { EstacaoView } from "@/infra/composition/config";
import type { QuiosqueView } from "@/infra/composition/quiosque";
import { dataHora } from "@/ui/format";
import {
  acaoAdicionarEstacao,
  acaoGerarQuiosque,
  acaoRemoverEstacao,
  acaoRenomearEstacao,
  acaoReordenarEstacoes,
  acaoRevogarQuiosque,
} from "./actions";
import { QuiosqueModal } from "./quiosque-modal";

/**
 * Editor das estações do setor (I2). Reordenar por ↑/↓ (sem drag-and-drop: robusto no toque e no
 * build), renomear inline, remover com confirmação, adicionar ao fim. Cada ação fala com o servidor
 * (RBAC + RLS) e dá refresh. Otimista o suficiente pra parecer instantâneo sem mentir.
 */
export function EditorEstacoes({
  estacoes,
  quiosquePorEstacao,
}: {
  estacoes: EstacaoView[];
  quiosquePorEstacao: Record<string, QuiosqueView>;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState("");
  const [quiosqueAberto, setQuiosqueAberto] = useState<{
    estacaoNome: string;
    qrDataUrl: string;
    codigoCurto: string;
  } | null>(null);

  function rodar(acao: () => Promise<{ ok: boolean; motivo?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) {
        setErro(r.motivo ?? "Não deu certo. Tente novamente.");
        return;
      }
      router.refresh();
    });
  }

  function adicionar() {
    const nome = novo.trim();
    if (!nome) {
      return;
    }
    rodar(async () => {
      const r = await acaoAdicionarEstacao(nome);
      if (r.ok) {
        setNovo("");
      }
      return r;
    });
  }

  function mover(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= estacoes.length) {
      return;
    }
    const ids = estacoes.map((e) => e.id);
    [ids[indice], ids[alvo]] = [ids[alvo]!, ids[indice]!];
    rodar(() => acaoReordenarEstacoes(ids));
  }

  function ligarQuiosque(e: EstacaoView) {
    setErro(null);
    iniciar(async () => {
      const r = await acaoGerarQuiosque(e.id);
      if (!r.ok || !r.qrDataUrl || !r.codigoCurto) {
        setErro(r.motivo ?? "Não foi possível gerar o quiosque. Tente novamente.");
        return;
      }
      setQuiosqueAberto({ estacaoNome: e.nome, qrDataUrl: r.qrDataUrl, codigoCurto: r.codigoCurto });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2">
        {estacoes.map((e, i) => (
          <LinhaEstacao
            key={e.id}
            estacao={e}
            quiosque={quiosquePorEstacao[e.id] ?? null}
            posicao={i + 1}
            primeira={i === 0}
            ultima={i === estacoes.length - 1}
            pendente={pendente}
            onSubir={() => mover(i, -1)}
            onDescer={() => mover(i, 1)}
            onRenomear={(nome) => rodar(() => acaoRenomearEstacao(e.id, nome))}
            onRemover={() => rodar(() => acaoRemoverEstacao(e.id))}
            onLigarQuiosque={() => ligarQuiosque(e)}
            onRevogarQuiosque={(quiosqueId) => rodar(() => acaoRevogarQuiosque(quiosqueId))}
          />
        ))}
      </ol>

      {estacoes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-grafite-600 bg-grafite-850 px-4 py-6 text-center font-body text-sm text-aco-400">
          Sem estações ainda. Adicione a primeira abaixo — é por onde o trabalho passa no chão.
        </p>
      ) : null}

      <div className="flex gap-2">
        <input
          value={novo}
          onChange={(ev) => setNovo(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              adicionar();
            }
          }}
          placeholder="Nome da nova estação (ex.: Mandrilhamento)"
          className="flex-1 rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={adicionar}
          disabled={pendente || !novo.trim()}
          className="rounded-md bg-ambar-500 px-4 py-2 font-display text-sm font-bold text-grafite-900 transition-colors hover:bg-ambar-600 disabled:opacity-50"
        >
          Adicionar
        </button>
      </div>

      {erro ? (
        <p role="alert" className="font-body text-sm text-sinal-vermelho">
          {erro}
        </p>
      ) : null}

      {quiosqueAberto ? (
        <QuiosqueModal
          estacaoNome={quiosqueAberto.estacaoNome}
          qrDataUrl={quiosqueAberto.qrDataUrl}
          codigoCurto={quiosqueAberto.codigoCurto}
          onFechar={() => setQuiosqueAberto(null)}
        />
      ) : null}
    </div>
  );
}

function LinhaEstacao({
  estacao,
  quiosque,
  posicao,
  primeira,
  ultima,
  pendente,
  onSubir,
  onDescer,
  onRenomear,
  onRemover,
  onLigarQuiosque,
  onRevogarQuiosque,
}: {
  estacao: EstacaoView;
  quiosque: QuiosqueView | null;
  posicao: number;
  primeira: boolean;
  ultima: boolean;
  pendente: boolean;
  onSubir: () => void;
  onDescer: () => void;
  onRenomear: (nome: string) => void;
  onRemover: () => void;
  onLigarQuiosque: () => void;
  onRevogarQuiosque: (quiosqueId: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(estacao.nome);
  const [confirmandoRemover, setConfirmandoRemover] = useState(false);
  const [confirmandoRevogar, setConfirmandoRevogar] = useState(false);

  function salvar() {
    const limpo = nome.trim();
    if (limpo && limpo !== estacao.nome) {
      onRenomear(limpo);
    } else {
      setNome(estacao.nome);
    }
    setEditando(false);
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-grafite-700 bg-grafite-850 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-grafite-700 font-mono text-sm text-aco-300">
          {posicao}
        </span>

        {editando ? (
          <input
            autoFocus
            value={nome}
            onChange={(ev) => setNome(ev.target.value)}
            onBlur={salvar}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                salvar();
              }
              if (ev.key === "Escape") {
                setNome(estacao.nome);
                setEditando(false);
              }
            }}
            className="flex-1 rounded-md border border-ambar-500 bg-grafite-900 px-2 py-1 font-body text-sm text-aco-100 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="flex-1 text-left font-body text-sm text-aco-100 hover:text-ambar-500"
          >
            {estacao.nome}
          </button>
        )}

        <div className="flex items-center gap-1">
          <BotaoIcone aria-label="Subir" disabled={pendente || primeira} onClick={onSubir}>
            ↑
          </BotaoIcone>
          <BotaoIcone aria-label="Descer" disabled={pendente || ultima} onClick={onDescer}>
            ↓
          </BotaoIcone>
          {confirmandoRemover ? (
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={onRemover}
                disabled={pendente}
                className="rounded-md bg-sinal-vermelho px-2 py-1 font-mono text-xs text-grafite-900 disabled:opacity-50"
              >
                Remover
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoRemover(false)}
                className="rounded-md px-2 py-1 font-mono text-xs text-aco-400 hover:text-aco-100"
              >
                Não
              </button>
            </span>
          ) : (
            <BotaoIcone
              aria-label="Remover"
              disabled={pendente}
              onClick={() => setConfirmandoRemover(true)}
            >
              ×
            </BotaoIcone>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-grafite-700 pt-2 pl-11">
        {quiosque ? (
          <>
            <p className="flex-1 font-mono text-xs text-aco-400">
              Quiosque ativo · código {quiosque.codigoCurto}
              {quiosque.ultimoUsoEm ? ` · usado em ${dataHora(quiosque.ultimoUsoEm)}` : " · ainda não usado"}
            </p>
            {confirmandoRevogar ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onRevogarQuiosque(quiosque.id)}
                  disabled={pendente}
                  className="rounded-md bg-sinal-vermelho px-2 py-1 font-mono text-xs text-grafite-900 disabled:opacity-50"
                >
                  Revogar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoRevogar(false)}
                  className="rounded-md px-2 py-1 font-mono text-xs text-aco-400 hover:text-aco-100"
                >
                  Não
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmandoRevogar(true)}
                disabled={pendente}
                className="rounded-md border border-grafite-600 px-2 py-1 font-mono text-xs text-aco-400 hover:border-sinal-vermelho hover:text-sinal-vermelho disabled:opacity-50"
              >
                Revogar
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onLigarQuiosque}
            disabled={pendente}
            className="rounded-md border border-grafite-600 px-2 py-1 font-mono text-xs text-aco-300 hover:border-ambar-500 hover:text-ambar-500 disabled:opacity-50"
          >
            Ligar tablet
          </button>
        )}
      </div>
    </li>
  );
}

function BotaoIcone({
  children,
  onClick,
  disabled,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className="grid size-8 place-items-center rounded-md border border-grafite-600 font-mono text-base text-aco-300 transition-colors hover:border-aco-400 hover:text-aco-100 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
