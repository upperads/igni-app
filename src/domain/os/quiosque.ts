/**
 * Quiosque de setor (P-0) — regras puras do CÓDIGO CURTO de backup. O código é só um atalho pra
 * ligar o tablet (troca-se pelo token forte no servidor); nunca é credencial permanente. Alfabeto
 * sem caracteres ambíguos (é ditado/digitado no chão). O sufixo aleatório vem da infra (crypto).
 */
export const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Prefixo legível (máx. 5 letras do nome do setor) + "-" + sufixo aleatório. Ex.: "BLOCO-4K2P". */
export function gerarCodigoCurto(nomeEstacao: string, sufixoAleatorio: string): string {
  const soLetras = nomeEstacao.toUpperCase().replace(/[^A-Z]/g, "");
  const prefixo = soLetras.slice(0, 5) || "SETOR";
  return `${prefixo}-${sufixoAleatorio}`;
}
