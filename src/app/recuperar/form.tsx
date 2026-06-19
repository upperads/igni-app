"use client";

import { type FormEvent, useState } from "react";
import { createSupabaseBrowser } from "@/infra/auth/supabase-browser";
import { Button } from "@/ui/components/button";
import { TextField } from "@/ui/components/text-field";

export function FormRecuperar() {
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    const supabase = createSupabaseBrowser();
    // Sucesso é indiferente à existência do e-mail (não revela se há conta) — segurança.
    await supabase.auth.resetPasswordForEmail(email);
    setEnviando(false);
    setEnviado(true);
  }

  if (enviado) {
    return (
      <p
        role="status"
        className="rounded-lg border border-grafite-700 bg-grafite-800 p-5 font-body text-sm text-aco-200"
      >
        Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha. Confira a sua
        caixa de entrada.
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <TextField label="E-mail" name="email" type="email" required autoComplete="email" />
      <Button type="submit" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar link de redefinição"}
      </Button>
    </form>
  );
}
