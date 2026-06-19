"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { forcaSenha } from "@/domain/auth/forca-senha";
import { createSupabaseBrowser } from "@/infra/auth/supabase-browser";
import { Button } from "@/ui/components/button";
import { INPUT_CLASS, LABEL_CLASS } from "@/ui/components/text-field";
import { MedidorForca } from "@/ui/components/medidor-forca";

export function FormAtualizarSenha() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const forca = forcaSenha(senha);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (senha.length < 8) {
      setErro("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    setEnviando(true);
    setErro("");
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) {
      // Contas com 2FA exigem AAL2 para trocar a senha (o link sozinho não basta) — Supabase
      // retorna 401 nesse caso. Caso contrário, o link provavelmente expirou.
      setErro(
        "Não foi possível atualizar a senha. Se a sua conta tem verificação em duas etapas, entre normalmente para trocá-la. Caso contrário, o link pode ter expirado; peça um novo.",
      );
      return;
    }
    router.replace("/");
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="senha" className={LABEL_CLASS}>
          Nova senha
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

      {erro ? (
        <p role="alert" className="font-body text-sm text-sinal-vermelho">
          {erro}
        </p>
      ) : null}

      <Button type="submit" disabled={enviando || senha.length < 8}>
        {enviando ? "Salvando…" : "Salvar nova senha"}
      </Button>
    </form>
  );
}
