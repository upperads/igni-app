"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { AbrirOSInput } from "@/application/abrir-os";
import type { EstadoOS } from "@/domain/os/estado";
import { DadosInvalidosError } from "@/domain/shared/errors";
import { sessaoAtual } from "@/infra/auth/sessao";
import { abrirOsNoTenant, transicionarNoTenant } from "@/infra/composition/os";

const TIPOS_CLIENTE = ["frota", "produtor", "avulso"] as const;
const MODALIDADES = ["so_usinagem", "empresa_retira", "ja_desmontado"] as const;

type TipoCliente = (typeof TIPOS_CLIENTE)[number];
type Modalidade = (typeof MODALIDADES)[number];

function vazioParaNulo(valor: string): string | null {
  const limpo = valor.trim();
  return limpo.length > 0 ? limpo : null;
}

export interface EstadoAbrirOs {
  erro?: string;
}

/** US-04 — abre a OS a partir do formulário e leva direto ao detalhe recém-criado. */
export async function acaoAbrirOs(
  _anterior: EstadoAbrirOs,
  formData: FormData,
): Promise<EstadoAbrirOs> {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { erro: "Sua sessão expirou. Entre novamente." };
  }

  const tipoCliente = String(formData.get("tipoCliente") ?? "");
  const modalidade = String(formData.get("modalidade") ?? "");
  if (!TIPOS_CLIENTE.includes(tipoCliente as TipoCliente)) {
    return { erro: "Selecione um tipo de cliente válido." };
  }
  if (!MODALIDADES.includes(modalidade as Modalidade)) {
    return { erro: "Selecione uma modalidade de entrada válida." };
  }

  const input: AbrirOSInput = {
    cliente: {
      nome: String(formData.get("nome") ?? ""),
      contatoWhatsapp: vazioParaNulo(String(formData.get("whatsapp") ?? "")),
      tipo: tipoCliente as TipoCliente,
    },
    equipamento: {
      tipo: String(formData.get("tipoEquipamento") ?? ""),
      placa: vazioParaNulo(String(formData.get("placa") ?? "")),
      modeloMotor: vazioParaNulo(String(formData.get("modeloMotor") ?? "")),
    },
    entrada: { modalidade: modalidade as Modalidade },
    tipoServico: vazioParaNulo(String(formData.get("tipoServico") ?? "")),
  };

  let osId: string;
  try {
    const r = await abrirOsNoTenant(sessao, input);
    osId = r.osId;
  } catch (erro) {
    if (erro instanceof DadosInvalidosError) {
      return { erro: erro.message };
    }
    return { erro: "Não foi possível abrir a OS. Tente novamente." };
  }

  redirect(`/os/${osId}`);
}

export interface ResultadoAcao {
  ok: boolean;
  motivo?: string;
}

/**
 * US-05 — move a OS para o próximo estado. O contexto dos gates (orçamento/CQ) ainda não existe
 * (M5); por ora vai vazio, então execução e "pronta" ficam barradas com o motivo do gate — que é
 * exatamente a regra de ouro em ação. M5 liga o contexto real.
 */
export async function acaoTransicionar(
  osId: string,
  para: EstadoOS,
  motivo?: string,
): Promise<ResultadoAcao> {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return { ok: false, motivo: "Sua sessão expirou. Entre novamente." };
  }

  try {
    const r = await transicionarNoTenant(sessao, {
      osId,
      para,
      contexto: { orcamentoAprovado: false, cqAprovado: false },
      motivo,
    });
    if (r.ok) {
      revalidatePath(`/os/${osId}`);
      revalidatePath("/os");
    }
    return { ok: r.ok, motivo: r.motivo };
  } catch {
    return { ok: false, motivo: "Não foi possível avançar a OS. Tente novamente." };
  }
}
