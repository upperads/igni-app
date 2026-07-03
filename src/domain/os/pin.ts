/**
 * PIN do chão (P-0): 4 dígitos que CARIMBAM quem avançou a OS no quiosque. Lógica pura.
 * Não é credencial de acesso (a porta é o token do quiosque) — só autoria. Guardado como hash.
 */
export function pinValido(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export function normalizarPin(pin: string | null | undefined): string | null {
  const limpo = (pin ?? "").trim();
  return pinValido(limpo) ? limpo : null;
}
