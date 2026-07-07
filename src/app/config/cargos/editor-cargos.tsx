"use client";

import { useMemo, useState, useTransition } from "react";
import { ehCargoDono, PERMISSOES, type Permissao } from "@/domain/auth/cargo";
import type { CargoView } from "@/infra/composition/cargo";
import { acaoCriarCargo, acaoEditarCargo, acaoExcluirCargo, acaoRenomearCargo } from "./actions";

const ROTULO_PERMISSAO: Record<Permissao, string> = {
  "os:abrir": "Abrir OS",
  "os:editar": "Editar OS",
  "os:avancar": "Avançar etapa (bump)",
  "triagem:override": "Mudar prioridade",
  "orcamento:editar": "Editar orçamento",
  "dinheiro:ver": "Ver valores",
  "dinheiro:ver_peca": "Ver custo de peça",
  "cadastro:editar": "Editar clientes/equipamentos",
  "equipe:gerir": "Gerir equipe",
  "config:editar": "Configurar (estações, quiosque)",
  "financeiro:gerir": "Gerir financeiro (contas a receber)",
};

const PROIBIDAS_CHAO: Permissao[] = ["orcamento:editar", "dinheiro:ver", "dinheiro:ver_peca", "financeiro:gerir"];
const GATILHOS_2FA: Permissao[] = ["equipe:gerir", "config:editar"];

export function EditorCargos({ cargos }: { cargos: CargoView[] }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function rodar(acao: () => Promise<{ ok: boolean; motivo?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) setErro(r.motivo ?? "Não deu certo.");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <NovoCargo pendente={pendente} onCriar={(nome, chao, exige2fa, perms) => rodar(() => acaoCriarCargo(nome, chao, exige2fa, perms))} />
      <ul className="flex flex-col gap-3">
        {cargos.map((c) => (
          <LinhaCargo
            key={c.id}
            cargo={c}
            pendente={pendente}
            onRenomear={(nome) => rodar(() => acaoRenomearCargo(c.id, nome))}
            onEditar={(nome, chao, exige2fa, perms) => rodar(() => acaoEditarCargo(c.id, nome, chao, exige2fa, perms))}
            onExcluir={() => rodar(() => acaoExcluirCargo(c.id))}
          />
        ))}
      </ul>
      {erro ? <p role="alert" className="font-body text-sm text-sinal-vermelho">{erro}</p> : null}
    </div>
  );
}

/** Matriz de permissões com os pisos ao vivo. Reutilizada pelo novo cargo e pela edição. */
function MatrizPermissoes({
  chao,
  selecionadas,
  readonly,
  onToggleChao,
  onTogglePermissao,
}: {
  chao: boolean;
  selecionadas: Set<Permissao>;
  readonly: boolean;
  onToggleChao: (v: boolean) => void;
  onTogglePermissao: (p: Permissao, v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 font-body text-sm text-aco-200">
        <input type="checkbox" checked={chao} disabled={readonly} onChange={(e) => onToggleChao(e.target.checked)} />
        Cargo de chão (quiosque) — não vê valores
      </label>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {PERMISSOES.map((p) => {
          const bloqueadaPorChao = chao && PROIBIDAS_CHAO.includes(p);
          return (
            <label key={p} className={`flex items-center gap-2 font-body text-sm ${bloqueadaPorChao ? "text-aco-600" : "text-aco-200"}`}>
              <input
                type="checkbox"
                checked={selecionadas.has(p)}
                disabled={readonly || bloqueadaPorChao}
                onChange={(e) => onTogglePermissao(p, e.target.checked)}
              />
              {ROTULO_PERMISSAO[p]}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function Selo2fa({ selecionadas, exige2fa, onToggle, travado }: {
  selecionadas: Set<Permissao>;
  exige2fa: boolean;
  onToggle: (v: boolean) => void;
  travado: boolean;
}) {
  const forcado = GATILHOS_2FA.some((g) => selecionadas.has(g));
  return (
    <label className="flex items-center gap-2 font-body text-sm text-aco-200">
      <input type="checkbox" checked={forcado || exige2fa} disabled={travado || forcado} onChange={(e) => onToggle(e.target.checked)} />
      Exige 2FA{forcado ? " (obrigatório para este conjunto)" : ""}
    </label>
  );
}

function NovoCargo({ pendente, onCriar }: {
  pendente: boolean;
  onCriar: (nome: string, chao: boolean, exige2fa: boolean, perms: string[]) => void;
}) {
  const [nome, setNome] = useState("");
  const [chao, setChao] = useState(false);
  const [exige2fa, setExige2fa] = useState(false);
  const [sel, setSel] = useState<Set<Permissao>>(new Set());

  function togglePermissao(p: Permissao, v: boolean) {
    setSel((s) => {
      const n = new Set(s);
      if (v) n.add(p); else n.delete(p);
      return n;
    });
  }
  function toggleChao(v: boolean) {
    setChao(v);
    if (v) setSel((s) => {
      const n = new Set(s);
      for (const p of PROIBIDAS_CHAO) n.delete(p);
      return n;
    });
  }
  function criar() {
    if (!nome.trim()) return;
    onCriar(nome, chao, exige2fa, [...sel]);
    setNome(""); setChao(false); setExige2fa(false); setSel(new Set());
  }

  return (
    <section className="rounded-lg border border-grafite-700 bg-grafite-850 p-4">
      <h2 className="font-display text-lg text-aco-100">Novo cargo</h2>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        aria-label="Nome do cargo"
        placeholder="Ex.: Comprador"
        className="mt-3 w-full rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
      />
      <div className="mt-3">
        <MatrizPermissoes chao={chao} selecionadas={sel} readonly={false} onToggleChao={toggleChao} onTogglePermissao={togglePermissao} />
      </div>
      <div className="mt-3">
        <Selo2fa selecionadas={sel} exige2fa={exige2fa} onToggle={setExige2fa} travado={false} />
      </div>
      <button
        type="button"
        onClick={criar}
        disabled={pendente || !nome.trim()}
        className="mt-4 rounded-md bg-ambar-500 px-4 py-2 font-body text-sm font-medium text-grafite-950 hover:bg-ambar-400 disabled:opacity-50"
      >
        Criar cargo
      </button>
    </section>
  );
}

function LinhaCargo({ cargo, pendente, onRenomear, onEditar, onExcluir }: {
  cargo: CargoView;
  pendente: boolean;
  onRenomear: (nome: string) => void;
  onEditar: (nome: string, chao: boolean, exige2fa: boolean, perms: string[]) => void;
  onExcluir: () => void;
}) {
  const ehDono = ehCargoDono(cargo.nome);
  const [nome, setNome] = useState(cargo.nome);
  const [chao, setChao] = useState(cargo.chao);
  const [exige2fa, setExige2fa] = useState(cargo.exige2fa);
  const [sel, setSel] = useState<Set<Permissao>>(() => new Set(cargo.permissoes));
  const readonlyPerms = cargo.sistema;

  const dirty = useMemo(() => nome !== cargo.nome || chao !== cargo.chao || exige2fa !== cargo.exige2fa
    || [...sel].sort().join() !== [...cargo.permissoes].sort().join(), [nome, chao, exige2fa, sel, cargo]);

  function togglePermissao(p: Permissao, v: boolean) {
    setSel((s) => { const n = new Set(s); if (v) n.add(p); else n.delete(p); return n; });
  }
  function toggleChao(v: boolean) {
    setChao(v);
    if (v) setSel((s) => { const n = new Set(s); for (const p of PROIBIDAS_CHAO) n.delete(p); return n; });
  }
  function salvar() {
    if (readonlyPerms) onRenomear(nome);
    else onEditar(nome, chao, exige2fa, [...sel]);
  }

  return (
    <li className="rounded-lg border border-grafite-700 bg-grafite-800 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {ehDono ? <span aria-hidden className="text-aco-400">🔒</span> : null}
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            aria-label={`Nome do cargo ${cargo.nome}`}
            disabled={ehDono}
            className="rounded-md border border-grafite-600 bg-grafite-900 px-2 py-1 font-body text-sm text-aco-100 disabled:opacity-60"
          />
          {cargo.sistema ? <span className="font-mono text-[11px] uppercase tracking-wide text-aco-500">sistema</span> : null}
        </div>
        {!cargo.sistema ? (
          <button type="button" onClick={onExcluir} disabled={pendente} className="font-body text-sm text-aco-400 hover:text-sinal-vermelho">
            Excluir
          </button>
        ) : null}
      </div>
      {!ehDono ? (
        <div className="mt-3 flex flex-col gap-3">
          <MatrizPermissoes chao={chao} selecionadas={sel} readonly={readonlyPerms} onToggleChao={toggleChao} onTogglePermissao={togglePermissao} />
          {!readonlyPerms ? <Selo2fa selecionadas={sel} exige2fa={exige2fa} onToggle={setExige2fa} travado={false} /> : null}
          <div>
            <button
              type="button"
              onClick={salvar}
              disabled={pendente || !dirty || !nome.trim()}
              className="rounded-md bg-ambar-500 px-3 py-1.5 font-body text-sm font-medium text-grafite-950 hover:bg-ambar-400 disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 font-body text-xs text-aco-500">O Dono tem todas as permissões e não pode ser alterado.</p>
      )}
    </li>
  );
}
