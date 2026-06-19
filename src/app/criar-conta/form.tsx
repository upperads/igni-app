"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { forcaSenha } from "@/domain/auth/forca-senha";
import { Button } from "@/ui/components/button";
import { MedidorForca } from "@/ui/components/medidor-forca";
import { INPUT_CLASS, LABEL_CLASS, TextField } from "@/ui/components/text-field";
import { acaoCriarConta, type EstadoCriarConta } from "./actions";

const RAMOS_UI = [
  { valor: "retifica_pesada_agro", rotulo: "Retífica pesada / agro" },
  { valor: "retifica_leve", rotulo: "Retífica leve" },
  { valor: "centro_automotivo", rotulo: "Centro automotivo" },
] as const;

const ESTADO_INICIAL: EstadoCriarConta = {};

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
      <TextField label="Nome da oficina" name="nomeOficina" required />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ramo" className={LABEL_CLASS}>
          Ramo
        </label>
        <select id="ramo" name="ramo" required defaultValue="retifica_leve" className={INPUT_CLASS}>
          {RAMOS_UI.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.rotulo}
            </option>
          ))}
        </select>
      </div>

      <TextField label="Seu nome" name="nome" required />
      <TextField label="E-mail" name="email" type="email" required autoComplete="email" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="senha" className={LABEL_CLASS}>
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className={INPUT_CLASS}
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
