/**
 * Força de senha para feedback em tempo real (UX da US-02). Pura, sem dependências — pode rodar
 * no cliente. Não substitui a regra do provedor (mínimo de 8); é orientação visual ao usuário.
 */
export interface ForcaSenha {
  nivel: 0 | 1 | 2 | 3 | 4;
  rotulo: string;
}

const ROTULOS = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"] as const;

export function forcaSenha(senha: string): ForcaSenha {
  let pontos = 0;
  if (senha.length >= 8) pontos += 1;
  if (senha.length >= 12) pontos += 1;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos += 1;
  if (/\d/.test(senha)) pontos += 1;
  if (/[^A-Za-z0-9]/.test(senha)) pontos += 1;

  const nivel = Math.min(4, pontos) as ForcaSenha["nivel"];
  return { nivel, rotulo: ROTULOS[nivel] };
}
