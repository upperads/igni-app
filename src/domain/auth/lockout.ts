/**
 * Lockout de login por tentativas (RNF-SEC-05). Lógica pura: recebe as tentativas FALHAS
 * relevantes (já filtradas pela aplicação para "após o último sucesso") e a política, e decide
 * se a conta está bloqueada. `agora` é injetado para testes determinísticos.
 */

export interface PoliticaLockout {
  /** N tentativas inválidas antes de bloquear (AUTH_MAX_LOGIN_ATTEMPTS, configurável). */
  maxTentativas: number;
  /** Janela de contagem e cooldown, em milissegundos. */
  janelaMs: number;
}

export interface AvaliacaoLockout {
  bloqueado: boolean;
  /** Quantas tentativas ainda restam antes do bloqueio (0 quando bloqueado). */
  tentativasRestantes: number;
  /** Quando a conta volta a poder tentar (null se não está bloqueada). */
  desbloqueioEm: Date | null;
}

export function avaliarLockout(
  falhasRecentes: readonly Date[],
  politica: PoliticaLockout,
  agora: Date,
): AvaliacaoLockout {
  const inicioDaJanela = agora.getTime() - politica.janelaMs;
  const naJanela = falhasRecentes.filter((d) => d.getTime() > inicioDaJanela);

  const bloqueado = naJanela.length >= politica.maxTentativas;
  const tentativasRestantes = Math.max(0, politica.maxTentativas - naJanela.length);

  let desbloqueioEm: Date | null = null;
  if (bloqueado) {
    const ultimaFalha = naJanela.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b));
    desbloqueioEm = new Date(ultimaFalha.getTime() + politica.janelaMs);
  }

  return { bloqueado, tentativasRestantes, desbloqueioEm };
}
