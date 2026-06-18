"use server";

import { DadosInvalidosError, EmailJaCadastradoError } from "@/domain/shared/errors";
import { RAMOS, type Ramo } from "@/domain/templates/ramo";
import { registrarOficina } from "@/infra/composition/auth";

export interface EstadoCriarConta {
  erro?: string;
  ok?: boolean;
}

export async function acaoCriarConta(
  _anterior: EstadoCriarConta,
  formData: FormData,
): Promise<EstadoCriarConta> {
  const nomeOficina = String(formData.get("nomeOficina") ?? "");
  const ramoBruto = String(formData.get("ramo") ?? "");
  const nome = String(formData.get("nome") ?? "");
  const email = String(formData.get("email") ?? "");
  const senha = String(formData.get("senha") ?? "");

  if (!RAMOS.includes(ramoBruto as Ramo)) {
    return { erro: "Selecione um ramo válido." };
  }

  try {
    await registrarOficina({
      nomeOficina,
      ramo: ramoBruto as Ramo,
      admin: { nome, email, senha },
    });
    return { ok: true };
  } catch (erro) {
    if (erro instanceof EmailJaCadastradoError) {
      return { erro: "Este e-mail já está cadastrado." };
    }
    if (erro instanceof DadosInvalidosError) {
      return { erro: erro.message };
    }
    return { erro: "Não foi possível criar a conta. Tente novamente." };
  }
}
