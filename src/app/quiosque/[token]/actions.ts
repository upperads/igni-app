"use server";

import { revalidatePath } from "next/cache";
import type { EstadoOS } from "@/domain/os/estado";
import { bumpQuiosquePublico } from "@/infra/composition/quiosque";

export interface ResultadoBumpQuiosque {
  ok: boolean;
  motivo?: string;
}

/** Bump pelo quiosque: token na URL + PIN digitado. Sem sessão; a credencial é o token. */
export async function acaoBumpQuiosque(
  token: string,
  osId: string,
  para: EstadoOS,
  pin: string,
): Promise<ResultadoBumpQuiosque> {
  const r = await bumpQuiosquePublico(token, osId, para, pin);
  if (r.ok) {
    revalidatePath(`/quiosque/${token}`);
  }
  return { ok: r.ok, motivo: r.motivo };
}
