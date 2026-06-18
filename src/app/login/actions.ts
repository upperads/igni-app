"use server";

import { redirect } from "next/navigation";
import { ContaBloqueadaError, CredenciaisInvalidasError } from "@/domain/shared/errors";
import { createSupabaseServer } from "@/infra/auth/supabase-server";
import { autenticar } from "@/infra/composition/auth";

export interface EstadoLogin {
  erro?: string;
  tentativasRestantes?: number;
}

export async function acaoLogin(_anterior: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "");
  const senha = String(formData.get("senha") ?? "");

  let destino: string;
  try {
    const supabase = await createSupabaseServer();
    const resultado = await autenticar(supabase, { email, senha });
    // Admin (dono/gestor) sem AAL2 vai para o 2FA; os demais entram direto.
    destino = resultado.mfaRequerido ? "/login/2fa" : "/";
  } catch (erro) {
    if (erro instanceof ContaBloqueadaError) {
      return { erro: "Conta bloqueada por excesso de tentativas. Tente novamente mais tarde." };
    }
    if (erro instanceof CredenciaisInvalidasError) {
      return { erro: "E-mail ou senha inválidos.", tentativasRestantes: erro.tentativasRestantes };
    }
    return { erro: "Não foi possível entrar. Tente novamente." };
  }

  // Fora do try/catch: redirect() lança o sinal NEXT_REDIRECT, que não deve ser engolido.
  redirect(destino);
}
