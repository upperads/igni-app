/**
 * Rate-limit leve em memória (janela fixa). Para o portal público (ADR-012): conter brute-force de
 * token e abuso das ações de decisão. LIMITAÇÃO HONESTA: é por-instância e zera no redeploy — bom o
 * bastante para o MVP single-instance no Railway. Um limitador durável (Postgres/Redis) é follow-up.
 */
const baldes = new Map<string, { contagem: number; reinicioEm: number }>();

export interface ConfigLimite {
  limite: number;
  janelaMs: number;
}

/** Retorna true se DENTRO do limite (pode prosseguir); false se estourou. `agora` injetável p/ teste. */
export function dentroDoLimite(chave: string, config: ConfigLimite, agora = Date.now()): boolean {
  const balde = baldes.get(chave);
  if (!balde || agora >= balde.reinicioEm) {
    baldes.set(chave, { contagem: 1, reinicioEm: agora + config.janelaMs });
    return true;
  }
  if (balde.contagem >= config.limite) {
    return false;
  }
  balde.contagem += 1;
  return true;
}
