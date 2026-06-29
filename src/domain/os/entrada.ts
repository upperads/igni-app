/**
 * Modalidade de entrada do serviço. Lógica pura: valores canônicos, rótulos e a regra do texto livre.
 * Espelha o enum `modalidade_entrada` do banco (teste de drift garante). "outra" carrega uma
 * descrição personalizada; as demais não.
 */

export const MODALIDADES_ENTRADA = [
  "so_usinagem",
  "empresa_retira",
  "ja_desmontado",
  "patio_oficina",
  "outra",
] as const;

export type ModalidadeEntrada = (typeof MODALIDADES_ENTRADA)[number];

export const ROTULO_MODALIDADE: Record<ModalidadeEntrada, string> = {
  so_usinagem: "Só usinagem (cliente desmonta e traz as peças)",
  empresa_retira: "Empresa retira (a oficina busca o equipamento)",
  ja_desmontado: "Já desmontado (cliente entrega desmontado)",
  patio_oficina: "Pátio da oficina (equipamento já está no pátio)",
  outra: "Outra (descrever)",
};

/** A modalidade "outra" exige um texto livre; as demais ignoram a descrição. */
export function exigeDescricao(modalidade: ModalidadeEntrada): boolean {
  return modalidade === "outra";
}

export function modalidadeValida(valor: string): valor is ModalidadeEntrada {
  return (MODALIDADES_ENTRADA as readonly string[]).includes(valor);
}

/**
 * Normaliza a descrição conforme a modalidade: texto aparado só para "outra" (e obrigatório),
 * `null` para as demais. Lança a mensagem do chamador se "outra" vier sem texto.
 */
export function resolverDescricao(
  modalidade: ModalidadeEntrada,
  descricaoBruta: string | null | undefined,
): string | null {
  if (!exigeDescricao(modalidade)) {
    return null;
  }
  const desc = (descricaoBruta ?? "").trim();
  if (!desc) {
    throw new Error("DESCRICAO_OBRIGATORIA");
  }
  return desc;
}
