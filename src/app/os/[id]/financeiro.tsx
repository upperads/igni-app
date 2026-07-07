"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FORMAS_PAGAMENTO, ROTULO_FORMA_PAGAMENTO } from "@/domain/financeiro/conta";
import type { ContaView } from "@/infra/composition/conta";
import { data, moeda } from "@/ui/format";
import { acaoCancelarCobranca, acaoDesfazerRecebimento, acaoRegistrarRecebimento } from "../actions";

const ROTULO: Record<ContaView["status"], string> = {
  aberta: "a receber",
  recebida: "recebido",
  cancelada: "cancelado",
};
const COR: Record<ContaView["status"], string> = {
  aberta: "text-ambar-500",
  recebida: "text-sinal-verde",
  cancelada: "text-aco-500",
};

/**
 * Bloco Financeiro do detalhe da OS (P-4a/P-4b): mostra a conta e permite registrar o recebimento
 * (baixa total, com forma + data), desfazer um recebimento, ou cancelar a cobrança. Tudo gated por
 * financeiro:gerir (`podeGerir`). Ver o bloco já é gated por dinheiro:ver (na page).
 */
export function Financeiro({ conta, osId, podeGerir }: { conta: ContaView; osId: string; podeGerir: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [forma, setForma] = useState<string>(FORMAS_PAGAMENTO[0]);
  const [confirmandoDesfazer, setConfirmandoDesfazer] = useState(false);

  function rodar(acao: () => Promise<{ ok: boolean; motivo?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) {
        setErro(r.motivo ?? "Não deu certo.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section aria-label="Financeiro" className="rounded-lg border border-grafite-700 bg-grafite-850 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-aco-400">Financeiro</p>
          <p className="mt-1 font-display text-xl text-aco-100">
            {moeda(conta.valorCentavos)}{" "}
            <span className={`font-body text-sm ${COR[conta.status]}`}>· {ROTULO[conta.status]}</span>
          </p>
          {conta.status === "recebida" && conta.formaPagamento ? (
            <p className="mt-0.5 font-body text-xs text-aco-400">
              recebido por {ROTULO_FORMA_PAGAMENTO[conta.formaPagamento]}
              {conta.recebidoEm ? ` em ${data(conta.recebidoEm)}` : ""}
            </p>
          ) : null}
        </div>

        {podeGerir ? (
          <div className="flex flex-wrap items-center gap-2">
            {conta.status === "aberta" && !registrando ? (
              <>
                <button
                  type="button"
                  onClick={() => setRegistrando(true)}
                  disabled={pendente}
                  className="rounded-md bg-ambar-500 px-3 py-1.5 font-body text-sm font-medium text-grafite-900 hover:bg-ambar-600 disabled:opacity-50"
                >
                  Registrar recebimento
                </button>
                <button
                  type="button"
                  onClick={() => rodar(() => acaoCancelarCobranca(conta.id, osId))}
                  disabled={pendente}
                  className="rounded-md border border-grafite-600 px-3 py-1.5 font-body text-sm text-aco-400 hover:border-sinal-vermelho hover:text-sinal-vermelho disabled:opacity-50"
                >
                  Cancelar cobrança
                </button>
              </>
            ) : null}

            {conta.status === "aberta" && registrando ? (
              <>
                <select
                  value={forma}
                  onChange={(e) => setForma(e.target.value)}
                  aria-label="Forma de pagamento"
                  disabled={pendente}
                  className="rounded-md border border-grafite-600 bg-grafite-900 px-2 py-1.5 font-body text-sm text-aco-100"
                >
                  {FORMAS_PAGAMENTO.map((f) => (
                    <option key={f} value={f}>
                      {ROTULO_FORMA_PAGAMENTO[f]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => rodar(() => acaoRegistrarRecebimento(conta.id, osId, forma))}
                  disabled={pendente}
                  className="rounded-md bg-sinal-verde px-3 py-1.5 font-body text-sm font-medium text-grafite-900 hover:opacity-90 disabled:opacity-50"
                >
                  Confirmar recebimento
                </button>
                <button
                  type="button"
                  onClick={() => setRegistrando(false)}
                  disabled={pendente}
                  className="rounded-md px-2 py-1.5 font-body text-sm text-aco-400 hover:text-aco-100"
                >
                  Cancelar
                </button>
              </>
            ) : null}

            {conta.status === "recebida" ? (
              confirmandoDesfazer ? (
                <span className="flex items-center gap-2">
                  <span className="font-body text-sm text-aco-300">Desfazer?</span>
                  <button
                    type="button"
                    onClick={() => rodar(() => acaoDesfazerRecebimento(conta.id, osId))}
                    disabled={pendente}
                    className="rounded-md bg-sinal-vermelho px-2 py-1 font-mono text-xs text-grafite-900 disabled:opacity-50"
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoDesfazer(false)}
                    className="rounded-md px-2 py-1 font-mono text-xs text-aco-400 hover:text-aco-100"
                  >
                    Não
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmandoDesfazer(true)}
                  disabled={pendente}
                  className="rounded-md border border-grafite-600 px-3 py-1.5 font-body text-sm text-aco-400 hover:border-ambar-500 hover:text-ambar-500 disabled:opacity-50"
                >
                  Desfazer recebimento
                </button>
              )
            ) : null}
          </div>
        ) : null}
      </div>
      {erro ? (
        <p role="alert" className="mt-2 font-body text-sm text-sinal-vermelho">
          {erro}
        </p>
      ) : null}
    </section>
  );
}
