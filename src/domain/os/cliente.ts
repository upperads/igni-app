/**
 * Cliente — regras puras. A chave do reuso é a normalização do WhatsApp: o mesmo número digitado de
 * formas diferentes ("(11) 99999-0001", "11999990001", "+55 11 99999 0001") deve casar, para não
 * duplicar o cliente a cada OS. Sem WhatsApp, não dá para reusar com segurança (nome varia demais).
 */

/** Só dígitos, com 55 (BR) na frente quando faltar. `null` se não há dígitos suficientes. */
export function normalizarWhatsapp(bruto: string | null | undefined): string | null {
  const digitos = (bruto ?? "").replace(/\D/g, "");
  if (digitos.length < 10) {
    return null;
  }
  return digitos.startsWith("55") ? digitos : `55${digitos}`;
}

export const TIPOS_CLIENTE = ["frota", "produtor", "avulso"] as const;
export type TipoCliente = (typeof TIPOS_CLIENTE)[number];

export const ROTULO_TIPO_CLIENTE: Record<TipoCliente, string> = {
  frota: "Frota",
  produtor: "Produtor",
  avulso: "Avulso",
};

export function tipoClienteValido(valor: string): valor is TipoCliente {
  return (TIPOS_CLIENTE as readonly string[]).includes(valor);
}
