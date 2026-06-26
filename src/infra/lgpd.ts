/**
 * Mascaramento de dados pessoais (LGPD, RNF-SEC-08). Chassi é dado sensível: no portal público
 * (cujo link pode ser repassado) mostramos só o final, o suficiente para o cliente reconhecer o
 * equipamento sem expor o identificador inteiro a quem porventura tiver o link.
 */
export function mascararChassi(chassi: string | null): string | null {
  if (!chassi) {
    return null;
  }
  const limpo = chassi.trim();
  if (limpo.length <= 4) {
    return `••• ${limpo}`;
  }
  return `••• ${limpo.slice(-4)}`;
}
