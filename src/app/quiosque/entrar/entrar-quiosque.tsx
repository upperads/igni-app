"use client";

import { useActionState } from "react";
import { Button } from "@/ui/components/button";
import { TextField } from "@/ui/components/text-field";
import { acaoEntrarPorCodigo, type EstadoEntrarQuiosque } from "./actions";

const INICIAL: EstadoEntrarQuiosque = {};

export function EntrarQuiosque() {
  const [estado, acao, pendente] = useActionState(acaoEntrarPorCodigo, INICIAL);

  return (
    <form action={acao} className="flex w-full flex-col gap-4">
      <TextField
        label="Código do setor"
        name="codigo"
        required
        autoComplete="off"
        autoCapitalize="characters"
        className="text-center font-mono text-lg tracking-[0.3em] uppercase"
      />

      {estado.erro ? (
        <p role="alert" className="font-body text-sm text-sinal-vermelho">
          {estado.erro}
        </p>
      ) : null}

      <Button type="submit" disabled={pendente} className="min-h-14 text-base">
        {pendente ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
