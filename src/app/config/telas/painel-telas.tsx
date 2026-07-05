"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { TelaView } from "@/infra/composition/tela";
import { dataHora } from "@/ui/format";
import { acaoConfigurarTela, acaoRegistrarTela, acaoRevogarTela } from "./actions";

type Estacao = { id: string; nome: string };
type NovoQr = { qrDataUrl: string; codigoCurto: string; url: string };

/**
 * Painel das TVs de setor (P-3): registra (QR + código curto, mostrado uma vez), troca remotamente
 * o que cada TV mostra — o coração da fatia, dispara o ping via `configurarTelaNoTenant` — e revoga.
 */
export function PainelTelas({ telas, estacoes }: { telas: TelaView[]; estacoes: Estacao[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [novoQr, setNovoQr] = useState<NovoQr | null>(null);

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

  return (
    <div className="flex flex-col gap-4">
      {novoQr ? <QrRegistrado qr={novoQr} onFechar={() => setNovoQr(null)} /> : null}

      <ul className="flex flex-col gap-2">
        {telas.map((t) => (
          <LinhaTela
            key={t.id}
            tela={t}
            estacoes={estacoes}
            pendente={pendente}
            onConfigurar={(nome, modo, estacaoId) =>
              rodar(() => acaoConfigurarTela(t.id, nome, modo, estacaoId))
            }
            onRevogar={() => rodar(() => acaoRevogarTela(t.id))}
          />
        ))}
      </ul>

      {telas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-grafite-600 bg-grafite-850 px-4 py-6 text-center font-body text-sm text-aco-400">
          Sem telas ainda. Registre a primeira abaixo — é a TV que fica pendurada no setor.
        </p>
      ) : null}

      <NovaTela
        estacoes={estacoes}
        pendente={pendente}
        onRegistrar={(nome, modo, estacaoId) =>
          iniciar(async () => {
            setErro(null);
            const r = await acaoRegistrarTela(nome, modo, estacaoId);
            if (!r.ok || !r.qrDataUrl || !r.codigoCurto || !r.url) {
              setErro(r.motivo ?? "Não foi possível registrar a tela. Tente novamente.");
              return;
            }
            setNovoQr({ qrDataUrl: r.qrDataUrl, codigoCurto: r.codigoCurto, url: r.url });
            router.refresh();
          })
        }
      />

      {erro ? (
        <p role="alert" className="font-body text-sm text-sinal-vermelho">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

function QrRegistrado({ qr, onFechar }: { qr: NovoQr; onFechar: () => void }) {
  return (
    <section className="rounded-lg border border-ambar-600/40 bg-grafite-850 p-4">
      <h2 className="font-display text-lg text-aco-100">Tela registrada — conecte a TV</h2>
      <p className="mt-1 font-body text-sm text-aco-400">
        Abra <span className="font-mono text-aco-300">/tv/entrar</span> na TV e digite o código, ou
        aponte a câmera para o QR. Este código aparece só agora.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-5">
        <div className="grid place-items-center rounded-lg bg-white p-3">
          <Image
            src={qr.qrDataUrl}
            alt="QR da tela"
            width={160}
            height={160}
            unoptimized
            className="size-40"
          />
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-aco-400">
            Código curto de backup
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-ambar-500">
            {qr.codigoCurto}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-aco-400">{qr.url}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onFechar}
        className="mt-4 rounded-md bg-grafite-700 px-4 py-2 font-body text-sm text-aco-200 hover:text-aco-100"
      >
        Fechar
      </button>
    </section>
  );
}

function SeletorModo({
  modo,
  estacaoId,
  estacoes,
  disabled,
  idPrefixo,
  onModo,
  onEstacao,
}: {
  modo: string;
  estacaoId: string | null;
  estacoes: Estacao[];
  disabled: boolean;
  idPrefixo: string;
  onModo: (m: string) => void;
  onEstacao: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={modo}
        disabled={disabled}
        onChange={(e) => onModo(e.target.value)}
        aria-label={`O que a tela ${idPrefixo} mostra`}
        className="rounded-md border border-grafite-600 bg-grafite-900 px-2 py-1.5 font-body text-sm text-aco-100 focus:border-ambar-500 focus:outline-none disabled:opacity-50"
      >
        <option value="estacao">Uma estação</option>
        <option value="geral">Visão geral (tudo)</option>
      </select>
      {modo === "estacao" ? (
        <select
          value={estacaoId ?? ""}
          disabled={disabled}
          onChange={(e) => onEstacao(e.target.value || null)}
          aria-label={`Qual estação a tela ${idPrefixo} mostra`}
          className="rounded-md border border-grafite-600 bg-grafite-900 px-2 py-1.5 font-body text-sm text-aco-100 focus:border-ambar-500 focus:outline-none disabled:opacity-50"
        >
          <option value="">Escolha a estação…</option>
          {estacoes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function NovaTela({
  estacoes,
  pendente,
  onRegistrar,
}: {
  estacoes: Estacao[];
  pendente: boolean;
  onRegistrar: (nome: string, modo: string, estacaoId: string | null) => void;
}) {
  const [nome, setNome] = useState("");
  const [modo, setModo] = useState("estacao");
  const [estacaoId, setEstacaoId] = useState<string | null>(null);

  return (
    <section className="rounded-lg border border-grafite-700 bg-grafite-850 p-4">
      <h2 className="font-display text-lg text-aco-100">Nova tela</h2>
      <div className="mt-3 flex flex-col gap-3">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-label="Nome da tela"
          placeholder="Ex.: TV do Bloco"
          className="rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
        />
        <SeletorModo
          modo={modo}
          estacaoId={estacaoId}
          estacoes={estacoes}
          disabled={pendente}
          idPrefixo="nova"
          onModo={setModo}
          onEstacao={setEstacaoId}
        />
        <div>
          <button
            type="button"
            disabled={pendente || !nome.trim() || (modo === "estacao" && !estacaoId)}
            onClick={() => {
              onRegistrar(nome.trim(), modo, estacaoId);
              setNome("");
              setModo("estacao");
              setEstacaoId(null);
            }}
            className="rounded-md bg-ambar-500 px-4 py-2 font-display text-sm font-bold text-grafite-900 transition-colors hover:bg-ambar-600 disabled:opacity-50"
          >
            Registrar tela
          </button>
        </div>
      </div>
    </section>
  );
}

function LinhaTela({
  tela,
  estacoes,
  pendente,
  onConfigurar,
  onRevogar,
}: {
  tela: TelaView;
  estacoes: Estacao[];
  pendente: boolean;
  onConfigurar: (nome: string, modo: string, estacaoId: string | null) => void;
  onRevogar: () => void;
}) {
  const [nome, setNome] = useState(tela.nome);
  const [modo, setModo] = useState<string>(tela.modo);
  const [estacaoId, setEstacaoId] = useState<string | null>(tela.estacaoId);
  const [confirmandoRevogar, setConfirmandoRevogar] = useState(false);
  const mostraAgora = tela.modo === "geral" ? "Visão geral" : (tela.estacaoNome ?? "—");
  const mudouAlgo = nome.trim() !== tela.nome || modo !== tela.modo || estacaoId !== tela.estacaoId;

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-grafite-700 bg-grafite-850 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-body text-sm text-aco-100">{tela.nome}</p>
          <p className="font-mono text-xs text-aco-400">
            mostra: {mostraAgora} · código {tela.codigoCurto} ·{" "}
            {tela.ativo ? "ativa" : "revogada"}
            {tela.ultimoUsoEm ? ` · usada em ${dataHora(tela.ultimoUsoEm)}` : " · ainda não usada"}
          </p>
        </div>
        {tela.ativo ? (
          confirmandoRevogar ? (
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={onRevogar}
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
          )
        ) : null}
      </div>
      {tela.ativo ? (
        <div className="flex flex-col gap-2 border-t border-grafite-700 pt-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            aria-label={`Nome da tela ${tela.nome}`}
            disabled={pendente}
            className="rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 focus:border-ambar-500 focus:outline-none disabled:opacity-50"
          />
          <SeletorModo
            modo={modo}
            estacaoId={estacaoId}
            estacoes={estacoes}
            disabled={pendente}
            idPrefixo={tela.nome}
            onModo={setModo}
            onEstacao={setEstacaoId}
          />
          <div>
            <button
              type="button"
              disabled={pendente || !mudouAlgo || !nome.trim() || (modo === "estacao" && !estacaoId)}
              onClick={() => onConfigurar(nome.trim(), modo, estacaoId)}
              className="rounded-md bg-ambar-500 px-3 py-1.5 font-body text-sm font-medium text-grafite-900 hover:bg-ambar-600 disabled:opacity-50"
            >
              Salvar o que mostra
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
