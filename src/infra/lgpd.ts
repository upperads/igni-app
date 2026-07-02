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

/**
 * Máscara de placa para o portal público (consistência com o chassi): mostra os 3 primeiros
 * (o cliente reconhece o veículo) e oculta o resto. "ABC1D23" → "ABC••••". No fluxo normal o cliente
 * é o dono do carro, mas o link pode ser repassado — não expor a placa inteira a quem tiver o link.
 */
export function mascararPlaca(placa: string | null): string | null {
  if (!placa) {
    return null;
  }
  const limpo = placa.trim();
  if (limpo.length <= 3) {
    return limpo;
  }
  return `${limpo.slice(0, 3)}${"•".repeat(limpo.length - 3)}`;
}
