/**
 * Formatação de EXIBIÇÃO — o único lugar que decide como número, dinheiro, data e telefone aparecem
 * para o usuário (pt-BR). Não muda como o dado é ARMAZENADO (dinheiro em centavos, telefone
 * normalizado só-dígitos): só a apresentação. Centralizar evita o drift de ter `Intl.NumberFormat`
 * recriado em cada tela com formatos ligeiramente diferentes.
 *
 * Os formatadores `Intl.*` são criados uma vez (custam caro) e reusados.
 */

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const DATA_HORA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Dinheiro guardado em CENTAVOS inteiros → "R$ 1.234,56". */
export function moeda(centavos: number): string {
  return MOEDA.format(centavos / 100);
}

/** Data curta pt-BR → "30/06/2026". Aceita Date ou string ISO (ex.: `date` do Postgres). */
export function data(valor: Date | string): string {
  return DATA.format(typeof valor === "string" ? new Date(valor) : valor);
}

/** Data + hora pt-BR → "30/06/2026 14:07". */
export function dataHora(valor: Date | string): string {
  return DATA_HORA.format(typeof valor === "string" ? new Date(valor) : valor);
}

/** Só a hora pt-BR → "14:07". */
export function hora(valor: Date): string {
  return HORA.format(valor);
}

/**
 * Telefone normalizado (só dígitos, ex.: "5511999990001") → exibição pt-BR "(11) 99999-0001".
 * Tolerante: se não reconhecer o formato, devolve o que dá para mostrar sem quebrar. O `55` (BR) é
 * omitido na exibição — é ruído para o operador brasileiro.
 */
export function telefone(valor: string | null | undefined): string {
  const d = (valor ?? "").replace(/\D/g, "");
  if (!d) {
    return "";
  }
  // Remove o DDI 55 do Brasil para exibir só DDD + número.
  const nacional = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;

  if (nacional.length === 11) {
    // Celular: (11) 99999-0001
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  }
  if (nacional.length === 10) {
    // Fixo: (11) 9999-0001
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  }
  // Formato inesperado: mostra os dígitos como estão (melhor que quebrar).
  return nacional;
}
