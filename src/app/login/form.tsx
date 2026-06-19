"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/ui/components/button";
import { TextField } from "@/ui/components/text-field";
import { acaoLogin, type EstadoLogin } from "./actions";

const INICIAL: EstadoLogin = {};

export function FormLogin() {
  const [estado, acao, pendente] = useActionState(acaoLogin, INICIAL);

  return (
    <form action={acao} className="flex flex-col gap-4">
      <TextField label="E-mail" name="email" type="email" required autoComplete="email" />
      <TextField
        label="Senha"
        name="senha"
        type="password"
        required
        autoComplete="current-password"
      />

      {estado.erro ? (
        <p role="alert" className="font-body text-sm text-sinal-vermelho">
          {estado.erro}
          {typeof estado.tentativasRestantes === "number"
            ? ` ${estado.tentativasRestantes} tentativa(s) restante(s).`
            : ""}
        </p>
      ) : null}

      <Button type="submit" disabled={pendente}>
        {pendente ? "Entrando…" : "Entrar"}
      </Button>

      <p className="text-center font-body text-sm">
        <Link href="/recuperar" className="text-aco-400 hover:text-ambar-500 hover:underline">
          Esqueci a senha
        </Link>
      </p>

      <p className="text-center font-body text-sm text-aco-400">
        Não tem conta?{" "}
        <Link href="/criar-conta" className="text-ambar-500 hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
