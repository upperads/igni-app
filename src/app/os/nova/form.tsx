"use client";

import { useActionState, useState } from "react";
import { MODALIDADES_ENTRADA, ROTULO_MODALIDADE } from "@/domain/os/entrada";
import { Button } from "@/ui/components/button";
import { INPUT_CLASS, LABEL_CLASS, TextField } from "@/ui/components/text-field";
import { acaoAbrirOs, type EstadoAbrirOs } from "../actions";

const TIPOS_CLIENTE = [
  { valor: "frota", rotulo: "Frota" },
  { valor: "produtor", rotulo: "Produtor" },
  { valor: "avulso", rotulo: "Avulso" },
] as const;

const INICIAL: EstadoAbrirOs = {};

export function FormAbrirOs() {
  const [estado, acao, pendente] = useActionState(acaoAbrirOs, INICIAL);
  const [modalidade, setModalidade] = useState<string>("so_usinagem");

  return (
    <form action={acao} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-mono text-xs uppercase tracking-widest text-aco-400">
          Cliente
        </legend>
        <TextField label="Nome do cliente" name="nome" required />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tipoCliente" className={LABEL_CLASS}>
              Tipo
            </label>
            <select
              id="tipoCliente"
              name="tipoCliente"
              required
              defaultValue="avulso"
              className={INPUT_CLASS}
            >
              {TIPOS_CLIENTE.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </div>
          <TextField label="WhatsApp (opcional)" name="whatsapp" inputMode="tel" />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-mono text-xs uppercase tracking-widest text-aco-400">
          Equipamento
        </legend>
        <TextField label="Tipo / motor" name="tipoEquipamento" required placeholder="Ex.: Motor Scania DC13" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Placa (opcional)" name="placa" />
          <TextField label="Modelo do motor (opcional)" name="modeloMotor" />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-mono text-xs uppercase tracking-widest text-aco-400">
          Entrada
        </legend>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="modalidade" className={LABEL_CLASS}>
            Modalidade
          </label>
          <select
            id="modalidade"
            name="modalidade"
            required
            value={modalidade}
            onChange={(e) => setModalidade(e.target.value)}
            className={INPUT_CLASS}
          >
            {MODALIDADES_ENTRADA.map((m) => (
              <option key={m} value={m}>
                {ROTULO_MODALIDADE[m]}
              </option>
            ))}
          </select>
        </div>

        {modalidade === "outra" ? (
          <TextField
            label="Qual a modalidade?"
            name="modalidadeDescricao"
            required
            placeholder="Ex.: Guincho parceiro trouxe; cliente acompanha"
          />
        ) : null}

        <TextField
          label="Serviço pedido (opcional)"
          name="tipoServico"
          placeholder="Ex.: Retífica completa"
        />
      </fieldset>

      {estado.erro ? (
        <p role="alert" className="font-body text-sm text-sinal-vermelho">
          {estado.erro}
        </p>
      ) : null}

      <Button type="submit" disabled={pendente}>
        {pendente ? "Abrindo…" : "Abrir OS"}
      </Button>
    </form>
  );
}
