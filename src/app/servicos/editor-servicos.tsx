"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ROTULO_TIPO_ITEM, TIPOS_ITEM, type TipoItem } from "@/domain/orcamento/orcamento";
import type { ServicoView } from "@/infra/composition/servico";
import { moeda } from "@/ui/format";
import {
  acaoCriarServico,
  acaoDesativarServico,
  acaoEditarServico,
  acaoReativarServico,
} from "./actions";
import { ReajusteModal } from "./reajuste-modal";

/**
 * Editor do catálogo de serviços (P-2): agrupado por tipo (Peça / Mão de obra / Terceiro), CRUD
 * inline por linha e um formulário fixo para novo serviço. Inativos aparecem mais apagados com botão
 * "Reativar" — nunca somem de vez (o histórico de orçamento não depende deles). Mesmo padrão de
 * estado do editor de estações: `useTransition` + `router.refresh()` + erro em `role="alert"`.
 */
export function EditorServicos({ servicos }: { servicos: ServicoView[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [reajusteAberto, setReajusteAberto] = useState(false);

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

  const porTipo: Record<TipoItem, ServicoView[]> = { peca: [], mao_de_obra: [], terceiro: [] };
  for (const s of servicos) {
    porTipo[s.tipo].push(s);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <p className="font-body text-sm text-aco-400">
          {servicos.filter((s) => s.ativo).length} serviços ativos no catálogo.
        </p>
        <button
          type="button"
          onClick={() => setReajusteAberto(true)}
          className="rounded-md border border-grafite-600 px-3 py-2 font-body text-sm text-aco-300 hover:border-ambar-500 hover:text-ambar-500"
        >
          Reajustar todos
        </button>
      </div>

      {TIPOS_ITEM.map((tipo) => (
        <GrupoTipo
          key={tipo}
          tipo={tipo}
          servicos={porTipo[tipo]}
          pendente={pendente}
          onEditar={(id, input) => rodar(() => acaoEditarServico(id, input.tipo, input.nome, input.valor, input.markup))}
          onDesativar={(id) => rodar(() => acaoDesativarServico(id))}
          onReativar={(id) => rodar(() => acaoReativarServico(id))}
        />
      ))}

      {erro ? (
        <p role="alert" className="font-body text-sm text-sinal-vermelho">
          {erro}
        </p>
      ) : null}

      <NovoServico pendente={pendente} onCriar={(input) => rodar(() => acaoCriarServico(input.tipo, input.nome, input.valor, input.markup))} />

      {reajusteAberto ? <ReajusteModal onFechar={() => { setReajusteAberto(false); router.refresh(); }} /> : null}
    </div>
  );
}

interface InputForm {
  tipo: TipoItem;
  nome: string;
  valor: string;
  markup: string;
}

function GrupoTipo({
  tipo,
  servicos,
  pendente,
  onEditar,
  onDesativar,
  onReativar,
}: {
  tipo: TipoItem;
  servicos: ServicoView[];
  pendente: boolean;
  onEditar: (id: string, input: InputForm) => void;
  onDesativar: (id: string) => void;
  onReativar: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-aco-400">
        {ROTULO_TIPO_ITEM[tipo]}
      </h2>
      {servicos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-grafite-600 bg-grafite-850 px-4 py-4 text-center font-body text-sm text-aco-400">
          Nenhum serviço deste tipo ainda.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {servicos.map((s) => (
            <LinhaServico
              key={s.id}
              servico={s}
              pendente={pendente}
              onEditar={(input) => onEditar(s.id, input)}
              onDesativar={() => onDesativar(s.id)}
              onReativar={() => onReativar(s.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function LinhaServico({
  servico,
  pendente,
  onEditar,
  onDesativar,
  onReativar,
}: {
  servico: ServicoView;
  pendente: boolean;
  onEditar: (input: InputForm) => void;
  onDesativar: () => void;
  onReativar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(servico.nome);
  const [valor, setValor] = useState((servico.valorCentavos / 100).toFixed(2).replace(".", ","));
  const [markup, setMarkup] = useState(String(servico.markupPct));
  const [confirmandoDesativar, setConfirmandoDesativar] = useState(false);

  function cancelar() {
    setNome(servico.nome);
    setValor((servico.valorCentavos / 100).toFixed(2).replace(".", ","));
    setMarkup(String(servico.markupPct));
    setEditando(false);
  }

  function salvar() {
    onEditar({ tipo: servico.tipo, nome, valor, markup });
    setEditando(false);
  }

  return (
    <li
      className={`flex flex-col gap-2 rounded-lg border border-grafite-700 bg-grafite-850 px-3 py-2.5 ${
        servico.ativo ? "" : "opacity-50"
      }`}
    >
      {editando ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={nome}
            onChange={(ev) => setNome(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                salvar();
              }
              if (ev.key === "Escape") {
                cancelar();
              }
            }}
            className="min-w-[10rem] flex-1 rounded-md border border-ambar-500 bg-grafite-900 px-2 py-1 font-body text-sm text-aco-100 focus:outline-none"
          />
          <input
            value={valor}
            onChange={(ev) => setValor(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                salvar();
              }
              if (ev.key === "Escape") {
                cancelar();
              }
            }}
            placeholder="Valor R$"
            className="w-24 rounded-md border border-grafite-600 bg-grafite-900 px-2 py-1 font-body text-sm text-aco-100 focus:border-ambar-500 focus:outline-none"
          />
          <input
            value={markup}
            onChange={(ev) => setMarkup(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                salvar();
              }
              if (ev.key === "Escape") {
                cancelar();
              }
            }}
            placeholder="Markup %"
            className="w-20 rounded-md border border-grafite-600 bg-grafite-900 px-2 py-1 font-body text-sm text-aco-100 focus:border-ambar-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={salvar}
            disabled={pendente}
            className="rounded-md bg-ambar-500 px-3 py-1.5 font-display text-xs font-bold text-grafite-900 hover:bg-ambar-600 disabled:opacity-50"
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={cancelar}
            className="rounded-md px-3 py-1.5 font-mono text-xs text-aco-400 hover:text-aco-100"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="flex-1 text-left font-body text-sm text-aco-100 hover:text-ambar-500"
          >
            {servico.nome}
          </button>
          <span className="font-mono text-sm text-aco-300">{moeda(servico.valorCentavos)}</span>
          {servico.markupPct > 0 ? (
            <span className="font-mono text-xs text-aco-400">+{servico.markupPct}%</span>
          ) : null}

          {servico.ativo ? (
            confirmandoDesativar ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onDesativar}
                  disabled={pendente}
                  className="rounded-md bg-sinal-vermelho px-2 py-1 font-mono text-xs text-grafite-900 disabled:opacity-50"
                >
                  Desativar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoDesativar(false)}
                  className="rounded-md px-2 py-1 font-mono text-xs text-aco-400 hover:text-aco-100"
                >
                  Não
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmandoDesativar(true)}
                disabled={pendente}
                className="rounded-md border border-grafite-600 px-2 py-1 font-mono text-xs text-aco-400 hover:border-sinal-vermelho hover:text-sinal-vermelho disabled:opacity-50"
              >
                Desativar
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={onReativar}
              disabled={pendente}
              className="rounded-md border border-grafite-600 px-2 py-1 font-mono text-xs text-aco-300 hover:border-ambar-500 hover:text-ambar-500 disabled:opacity-50"
            >
              Reativar
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function NovoServico({
  pendente,
  onCriar,
}: {
  pendente: boolean;
  onCriar: (input: InputForm) => void;
}) {
  const [tipo, setTipo] = useState<TipoItem>("peca");
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [markup, setMarkup] = useState("");

  function criar() {
    if (!nome.trim() || !valor.trim()) {
      return;
    }
    onCriar({ tipo, nome, valor, markup });
    setNome("");
    setValor("");
    setMarkup("");
  }

  return (
    <div className="rounded-lg border border-grafite-700 bg-grafite-850 p-4">
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-aco-400">
        Novo serviço
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={tipo}
          onChange={(ev) => setTipo(ev.target.value as TipoItem)}
          className="rounded-md border border-grafite-600 bg-grafite-900 px-2 py-2 font-body text-sm text-aco-100 focus:border-ambar-500 focus:outline-none"
        >
          {TIPOS_ITEM.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TIPO_ITEM[t]}
            </option>
          ))}
        </select>
        <input
          value={nome}
          onChange={(ev) => setNome(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              criar();
            }
          }}
          placeholder="Nome do serviço (ex.: Retífica de bloco)"
          className="min-w-[12rem] flex-1 rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
        />
        <input
          value={valor}
          onChange={(ev) => setValor(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              criar();
            }
          }}
          placeholder="Valor R$"
          className="w-28 rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
        />
        <input
          value={markup}
          onChange={(ev) => setMarkup(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              criar();
            }
          }}
          placeholder="Markup % (opcional)"
          className="w-36 rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={criar}
          disabled={pendente || !nome.trim() || !valor.trim()}
          className="rounded-md bg-ambar-500 px-4 py-2 font-display text-sm font-bold text-grafite-900 transition-colors hover:bg-ambar-600 disabled:opacity-50"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}
