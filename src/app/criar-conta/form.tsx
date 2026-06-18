"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { forcaSenha, type ForcaSenha } from "@/domain/auth/forca-senha";
import { Button } from "@/ui/components/button";
import { cn } from "@/ui/cn";
import { acaoCriarConta, type EstadoCriarConta } from "./actions";

const RAMOS_UI = [
  { valor: "retifica_pesada_agro", rotulo: "Retífica pesada / agro" },
  { valor: "retifica_leve", rotulo: "Retífica leve" },
  { valor: "centro_automotivo", rotulo: "Centro automotivo" },
] as const;

const ESTADO_INICIAL: EstadoCriarConta = {};

const INPUT =
  "min-h-12 rounded-md border border-grafite-600 bg-grafite-800 px-3 font-body text-sm text-aco-100 placeholder:text-aco-400";
const LABEL = "font-mono text-xs uppercase tracking-wide text-aco-400";

function Campo({
  label,
  name,
  type = "text",
}: {
  label: string;
  name: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className={LABEL}>
        {label}
      </label>
      <input id={name} name={name} type={type} required className={INPUT} />
    </div>
  );
}

function MedidorForca({ forca }: { forca: ForcaSenha }) {
  const cor =
    forca.nivel <= 1 ? "bg-sinal-vermelho" : forca.nivel === 2 ? "bg-sinal-amarelo" : "bg-sinal-verde";
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded", i < forca.nivel ? cor : "bg-grafite-700")} />
        ))}
      </div>
      <span className="font-mono text-[11px] text-aco-400">{forca.rotulo}</span>
    </div>
  );
}

export function FormCriarConta() {
  const [estado, acao, pendente] = useActionState(acaoCriarConta, ESTADO_INICIAL);
  const [senha, setSenha] = useState("");
  const forca = forcaSenha(senha);

  if (estado.ok) {
    return (
      <div role="status" className="rounded-lg border border-sinal-verde/40 bg-grafite-800 p-5">
        <p className="font-display text-lg text-aco-100">Conta criada.</p>
        <p className="mt-1 font-body text-sm text-aco-400">
          Sua oficina já está pronta, com as estações do seu ramo carregadas. Agora é só entrar.
        </p>
        <Link href="/login" className="mt-4 inline-flex">
          <Button>Ir para o login</Button>
        </Link>
      </div>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo label="Nome da oficina" name="nomeOficina" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ramo" className={LABEL}>
          Ramo
        </label>
        <select id="ramo" name="ramo" required defaultValue="retifica_leve" className={INPUT}>
          {RAMOS_UI.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.rotulo}
            </option>
          ))}
        </select>
      </div>

      <Campo label="Seu nome" name="nome" />
      <Campo label="E-mail" name="email" type="email" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="senha" className={LABEL}>
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          minLength={8}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className={INPUT}
          aria-describedby="forca-senha"
        />
        <div id="forca-senha">{senha.length > 0 ? <MedidorForca forca={forca} /> : null}</div>
      </div>

      {estado.erro ? (
        <p role="alert" className="font-body text-sm text-sinal-vermelho">
          {estado.erro}
        </p>
      ) : null}

      <Button type="submit" disabled={pendente}>
        {pendente ? "Criando…" : "Criar conta"}
      </Button>
    </form>
  );
}
