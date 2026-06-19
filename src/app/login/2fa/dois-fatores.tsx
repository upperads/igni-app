"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/infra/auth/supabase-browser";
import { Button } from "@/ui/components/button";
import { INPUT_CLASS } from "@/ui/components/text-field";

type Modo = "carregando" | "enroll" | "challenge" | "erro";

export function DoisFatores() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowser());
  const [modo, setModo] = useState<Modo>("carregando");
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!ativo) return;
      if (aal?.currentLevel === "aal2") {
        router.replace("/");
        return;
      }

      const { data: fatores } = await supabase.auth.mfa.listFactors();
      if (!ativo) return;
      const verificado = fatores?.totp?.find((f) => f.status === "verified");
      if (verificado) {
        setFactorId(verificado.id);
        setModo("challenge");
        return;
      }

      // Remove fatores pendentes (enroll interrompido) para não acumular.
      for (const f of fatores?.totp?.filter((f) => f.status !== "verified") ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data: en, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (!ativo) return;
      if (error || !en) {
        setErro("Não foi possível iniciar o segundo fator.");
        setModo("erro");
        return;
      }
      setFactorId(en.id);
      setQr(en.totp.qr_code);
      setSecret(en.totp.secret);
      setModo("enroll");
    })();
    return () => {
      ativo = false;
    };
  }, [supabase, router]);

  async function verificar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: codigo.trim(),
    });
    setEnviando(false);
    if (error) {
      setErro("Código inválido. Confira o app autenticador e tente de novo.");
      return;
    }
    router.replace("/");
  }

  if (modo === "carregando") {
    return <p className="font-body text-sm text-aco-400">Preparando o segundo fator…</p>;
  }

  if (modo === "erro") {
    return (
      <p role="alert" className="font-body text-sm text-sinal-vermelho">
        {erro}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {modo === "enroll" ? (
        <div className="flex flex-col gap-3">
          <p className="font-body text-sm text-aco-400">
            Abra seu app autenticador (Google Authenticator, Authy, 1Password) e leia o código
            abaixo. Se preferir, digite a chave manualmente.
          </p>
          {qr ? (
            // QR é um data URI (SVG) do Supabase Auth; não se beneficia do next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code para o app autenticador" className="size-48 rounded-md bg-white p-2" />
          ) : null}
          <div className="rounded-md border border-grafite-700 bg-grafite-800 p-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-aco-400">Chave</p>
            <code className="font-mono text-sm break-all text-aco-100">{secret}</code>
          </div>
        </div>
      ) : (
        <p className="font-body text-sm text-aco-400">
          Digite o código de 6 dígitos do seu app autenticador.
        </p>
      )}

      <form onSubmit={verificar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="codigo" className="font-mono text-xs uppercase tracking-wide text-aco-400">
            Código
          </label>
          <input
            id="codigo"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            className={`${INPUT_CLASS} font-mono tracking-[0.3em]`}
          />
        </div>
        {erro ? (
          <p role="alert" className="font-body text-sm text-sinal-vermelho">
            {erro}
          </p>
        ) : null}
        <Button type="submit" disabled={enviando || codigo.length < 6}>
          {enviando ? "Verificando…" : "Verificar e entrar"}
        </Button>
      </form>
    </div>
  );
}
