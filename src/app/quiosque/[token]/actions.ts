"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { EstadoOS } from "@/domain/os/estado";
import { bumpQuiosquePublico } from "@/infra/composition/quiosque";
import { dentroDoLimite } from "@/infra/rate-limit";

export interface ResultadoBumpQuiosque {
  ok: boolean;
  motivo?: string;
}

/**
 * Bump pelo quiosque: token na URL + PIN digitado. Sem sessão; a credencial é o token.
 *
 * RATE-LIMIT anti-brute-force do PIN: o tablet fica exposto no chão. Sem trava, alguém tentaria PINs
 * em loop (10 mil combinações) até acertar o de um produtivo e FALSIFICAR a autoria dos bumps (o PIN
 * não destranca a porta — o token faz isso — mas carimbar como outra pessoa quebra a rastreabilidade
 * que é o ponto do PIN). Limite baixo por token+IP: tentativa legítima é rara; brute-force é frequente.
 */
export async function acaoBumpQuiosque(
  token: string,
  osId: string,
  para: EstadoOS,
  pin: string,
): Promise<ResultadoBumpQuiosque> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!dentroDoLimite(`quiosque-bump:${token}:${ip}`, { limite: 6, janelaMs: 60_000 })) {
    return { ok: false, motivo: "Muitas tentativas. Aguarde um instante." };
  }
  const r = await bumpQuiosquePublico(token, osId, para, pin);
  if (r.ok) {
    revalidatePath(`/quiosque/${token}`);
  }
  return { ok: r.ok, motivo: r.motivo };
}
