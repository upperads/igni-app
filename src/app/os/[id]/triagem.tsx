"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PRIORIDADES, type Prioridade, type Responsabilidade } from "@/domain/os/triagem";
import { Button } from "@/ui/components/button";
import { INPUT_CLASS, LABEL_CLASS } from "@/ui/components/text-field";
import { acaoAjustarPrioridade, acaoDestravar, acaoTravar } from "../actions";

const PRIORIDADE_ROTULO: Record<Prioridade, string> = {
  critica: "Crítica",
  alta: "Alta",
  normal: "Normal",
  baixa: "Baixa",
};

interface Props {
  osId: string;
  prioridade: Prioridade;
  temOverride: boolean;
  travado: boolean;
}

/** Ações da triagem na OS (US-07/08): travar/destravar e fixar a prioridade (override registrado). */
export function AcoesTriagem({ osId, prioridade, temOverride, travado }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function rodar(acao: () => Promise<{ ok: boolean; motivo?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) {
        setErro(r.motivo ?? "Não foi possível concluir a ação.");
        return;
      }
      router.refresh();
    });
  }

  function onTravar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const motivo = String(form.get("motivo") ?? "");
    const responsabilidade = String(form.get("responsabilidade") ?? "") as Responsabilidade;
    rodar(() => acaoTravar(osId, motivo, responsabilidade));
  }

  function onOverride(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nova = String(form.get("prioridade") ?? "");
    const motivo = String(form.get("motivoPrioridade") ?? "");
    rodar(() => acaoAjustarPrioridade(osId, nova, motivo));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border border-grafite-700 bg-grafite-800 p-4">
        <p className="mb-3 font-mono text-xs uppercase tracking-wide text-aco-400">Travamento</p>
        {travado ? (
          <Button variante="fantasma" disabled={pendente} onClick={() => rodar(() => acaoDestravar(osId))}>
            Destravar
          </Button>
        ) : (
          <form onSubmit={onTravar} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="motivo" className={LABEL_CLASS}>
                  Motivo
                </label>
                <input id="motivo" name="motivo" required placeholder="Ex.: peça em trânsito" className={INPUT_CLASS} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="responsabilidade" className={LABEL_CLASS}>
                  De quem é a bola
                </label>
                <select id="responsabilidade" name="responsabilidade" required defaultValue="empresa" className={INPUT_CLASS}>
                  <option value="empresa">Oficina (mantém a vez)</option>
                  <option value="cliente">Cliente (pode perder a vez)</option>
                </select>
              </div>
            </div>
            <Button type="submit" variante="fantasma" disabled={pendente} className="self-start">
              Travar OS
            </Button>
          </form>
        )}
      </div>

      <form onSubmit={onOverride} className="rounded-md border border-grafite-700 bg-grafite-800 p-4">
        <p className="mb-3 font-mono text-xs uppercase tracking-wide text-aco-400">
          Prioridade {temOverride ? "(fixada manualmente)" : "(calculada)"}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="prioridade" className={LABEL_CLASS}>
              Fixar prioridade
            </label>
            <select id="prioridade" name="prioridade" defaultValue={prioridade} className={INPUT_CLASS}>
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {PRIORIDADE_ROTULO[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="motivoPrioridade" className={LABEL_CLASS}>
              Motivo (opcional)
            </label>
            <input id="motivoPrioridade" name="motivoPrioridade" placeholder="Por que está fixando" className={INPUT_CLASS} />
          </div>
        </div>
        <Button type="submit" variante="fantasma" disabled={pendente} className="mt-3 self-start">
          Fixar prioridade
        </Button>
      </form>

      {erro ? (
        <p role="alert" className="font-body text-sm text-sinal-vermelho">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
