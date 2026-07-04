import { AutorizacaoNegadaError } from "@/domain/shared/errors";
import { type Permissao, pode } from "./cargo";

/**
 * RBAC (P-1): agora opera sobre o CONJUNTO DE PERMISSÕES do cargo, não sobre o papel fixo.
 * `pode` vem do domínio de cargo. `assertPode` é o enforcement do servidor.
 */
export { pode } from "./cargo";
export type { Permissao } from "./cargo";

export function assertPode(permissoes: readonly string[], acao: Permissao): void {
  if (!pode(permissoes, acao)) {
    throw new AutorizacaoNegadaError("cargo", acao);
  }
}
