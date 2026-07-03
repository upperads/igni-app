"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { validarCodigoQuiosque } from "@/infra/composition/quiosque";
import { dentroDoLimite } from "@/infra/rate-limit";

export interface EstadoEntrarQuiosque {
  erro?: string;
}

/**
 * Entrada por código curto (backup do QR do token): valida e redireciona para `/quiosque/{codigo}` —
 * a rota `[token]` aceita token OU código curto (`resolverQuiosque` tenta os dois). Rate-limit por IP
 * porque o código curto é adivinhável (não é o token de alta entropia).
 */
export async function acaoEntrarPorCodigo(
  _anterior: EstadoEntrarQuiosque,
  form: FormData,
): Promise<EstadoEntrarQuiosque> {
  const codigo = String(form.get("codigo") ?? "").trim().toUpperCase();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";

  if (!dentroDoLimite(`quiosque-codigo:${ip}`, { limite: 10, janelaMs: 60_000 })) {
    return { erro: "Muitas tentativas. Aguarde um instante." };
  }
  if (!codigo || !(await validarCodigoQuiosque(codigo))) {
    return { erro: "Código inválido ou desligado. Confira com o escritório." };
  }

  redirect(`/quiosque/${encodeURIComponent(codigo)}`);
}
