"use server";

import { revalidatePath } from "next/cache";
import { aprovarPortal, recusarPortal } from "@/infra/composition/portal";
import { dentroDoLimite } from "@/infra/rate-limit";

export interface ResultadoDecisao {
  ok: boolean;
  motivo?: string;
}

// Conter abuso das decisões por link (ADR-012): poucas tentativas por token por minuto.
const LIMITE = { limite: 8, janelaMs: 60_000 };

async function decidir(
  token: string,
  acao: (t: string) => Promise<ResultadoDecisao>,
): Promise<ResultadoDecisao> {
  if (!dentroDoLimite(`portal-decisao:${token}`, LIMITE)) {
    return { ok: false, motivo: "Muitas tentativas. Aguarde um instante e tente de novo." };
  }
  try {
    const r = await acao(token);
    if (r.ok) {
      revalidatePath(`/portal/${token}`);
    }
    return r;
  } catch {
    return { ok: false, motivo: "Não foi possível registrar sua resposta. Tente de novo." };
  }
}

export async function acaoAprovarPortal(token: string): Promise<ResultadoDecisao> {
  return decidir(token, aprovarPortal);
}

export async function acaoRecusarPortal(token: string): Promise<ResultadoDecisao> {
  return decidir(token, recusarPortal);
}
