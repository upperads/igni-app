"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import type { SetorComEstacoes } from "@/infra/composition/setor";
import {
  acaoCriarSetor,
  acaoMoverEstacao,
  acaoRemoverSetor,
  acaoRenomearSetor,
  acaoReordenarSetores,
} from "./actions";

/**
 * Painel de setores (P-5a): cada setor é um grupo com suas estações aninhadas. CRUD de setor
 * (adicionar/renomear/↑↓/remover) espelha o editor de estações. Mover uma estação entre setores é
 * um <select> por linha — sem drag-and-drop, robusto no toque e no build.
 */
export function PainelSetores({ setores }: { setores: SetorComEstacoes[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState("");

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

  function mover(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= setores.length) {
      return;
    }
    const ids = setores.map((s) => s.id);
    [ids[indice], ids[alvo]] = [ids[alvo]!, ids[indice]!];
    rodar(() => acaoReordenarSetores(ids));
  }

  function adicionar() {
    const nome = novo.trim();
    if (!nome) {
      return;
    }
    rodar(async () => {
      const r = await acaoCriarSetor(nome);
      if (r.ok) {
        setNovo("");
      }
      return r;
    });
  }

  const opcoesSetor = setores.map((s) => ({ id: s.id, nome: s.nome }));

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {setores.map((s, i) => (
          <li key={s.id} className="rounded-lg border border-grafite-700 bg-grafite-850 p-3">
            <div className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-grafite-700 font-mono text-sm text-aco-300">
                {i + 1}
              </span>
              <NomeEditavel
                nome={s.nome}
                pendente={pendente}
                onRenomear={(nome) => rodar(() => acaoRenomearSetor(s.id, nome))}
              />
              <div className="flex items-center gap-1">
                <BotaoIcone aria-label="Subir" disabled={pendente || i === 0} onClick={() => mover(i, -1)}>
                  ↑
                </BotaoIcone>
                <BotaoIcone
                  aria-label="Descer"
                  disabled={pendente || i === setores.length - 1}
                  onClick={() => mover(i, 1)}
                >
                  ↓
                </BotaoIcone>
                <BotaoIcone
                  aria-label="Remover setor"
                  disabled={pendente}
                  onClick={() => rodar(() => acaoRemoverSetor(s.id))}
                >
                  ×
                </BotaoIcone>
              </div>
            </div>
            <ul className="mt-2 flex flex-col gap-1 border-t border-grafite-700 pt-2 pl-11">
              {s.estacoes.length === 0 ? (
                <li className="font-body text-xs text-aco-500">Sem estações neste setor.</li>
              ) : (
                s.estacoes.map((e) => (
                  <li key={e.id} className="flex items-center gap-2">
                    <span className="flex-1 font-body text-sm text-aco-200">{e.nome}</span>
                    <select
                      value={s.id}
                      aria-label={`Setor da estação ${e.nome}`}
                      disabled={pendente}
                      onChange={(ev) => rodar(() => acaoMoverEstacao(e.id, ev.target.value))}
                      className="rounded-md border border-grafite-600 bg-grafite-900 px-2 py-1 font-body text-xs text-aco-100"
                    >
                      {opcoesSetor.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nome}
                        </option>
                      ))}
                    </select>
                  </li>
                ))
              )}
            </ul>
          </li>
        ))}
      </ol>

      {setores.length === 0 ? (
        <p className="rounded-lg border border-dashed border-grafite-600 bg-grafite-850 px-4 py-6 text-center font-body text-sm text-aco-400">
          Sem setores ainda. Crie o primeiro abaixo — é o que a TV do chão vai mostrar.
        </p>
      ) : null}

      <div className="flex gap-2">
        <input
          value={novo}
          onChange={(ev) => setNovo(ev.target.value)}
          aria-label="Nome do novo setor"
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              adicionar();
            }
          }}
          placeholder="Nome do novo setor (ex.: Usinagem)"
          className="flex-1 rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
        />
        <button
          type="button"
          disabled={pendente || !novo.trim()}
          onClick={adicionar}
          className="rounded-md bg-ambar-500 px-4 py-2 font-display text-sm font-bold text-grafite-900 transition-colors hover:bg-ambar-600 disabled:opacity-50"
        >
          Adicionar setor
        </button>
      </div>

      {erro ? (
        <p role="alert" className="font-body text-sm text-sinal-vermelho">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

function NomeEditavel({
  nome,
  pendente,
  onRenomear,
}: {
  nome: string;
  pendente: boolean;
  onRenomear: (n: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(nome);

  function salvar() {
    const limpo = v.trim();
    if (limpo && limpo !== nome) {
      onRenomear(limpo);
    } else {
      setV(nome);
    }
    setEditando(false);
  }

  return editando ? (
    <input
      autoFocus
      value={v}
      disabled={pendente}
      aria-label="Renomear setor"
      onChange={(e) => setV(e.target.value)}
      onBlur={salvar}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          salvar();
        }
        if (e.key === "Escape") {
          setV(nome);
          setEditando(false);
        }
      }}
      className="flex-1 rounded-md border border-ambar-500 bg-grafite-900 px-2 py-1 font-body text-sm text-aco-100 focus:outline-none"
    />
  ) : (
    <button
      type="button"
      onClick={() => setEditando(true)}
      className="flex-1 text-left font-display text-base text-aco-100 hover:text-ambar-500"
    >
      {nome}
    </button>
  );
}

function BotaoIcone({
  children,
  onClick,
  disabled,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
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
