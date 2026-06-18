import { AutorizacaoNegadaError } from "@/domain/shared/errors";
import type { Papel } from "./papel";

/**
 * RBAC (RNF-SEC-02 / US-03). Ações são as MUTAÇÕES sensíveis do sistema; leitura é liberada a
 * todos os papéis autenticados. A UI usa `pode` para deixar campos read-only/ocultos; o servidor
 * usa `assertPode` para barrar de verdade (a checagem que vale é a do servidor).
 */
export const ACOES = [
  "os:abrir",
  "os:editar",
  "os:avancar",
  "orcamento:editar",
  "cadastro:editar",
  "triagem:override",
  "usuario:gerenciar",
  "config:editar",
] as const;

export type Acao = (typeof ACOES)[number];

const PERMISSOES: Record<Papel, readonly Acao[]> = {
  // Tier administrativo (exige 2FA): acesso total às ações modeladas.
  dono: ACOES,
  gestor: ACOES,
  // Recepção/orçamentista: opera OS, orçamento, cadastros e triagem; não administra o sistema.
  recepcao: ["os:abrir", "os:editar", "os:avancar", "orcamento:editar", "cadastro:editar", "triagem:override"],
  // Produção (chão): só avança etapas pelo bump. NÃO edita orçamento (regra de ouro do CLAUDE.md).
  producao: ["os:avancar"],
};

export function pode(papel: Papel, acao: Acao): boolean {
  return PERMISSOES[papel].includes(acao);
}

/** Enforcement no servidor: lança `AutorizacaoNegadaError` se o papel não pode a ação. */
export function assertPode(papel: Papel, acao: Acao): void {
  if (!pode(papel, acao)) {
    throw new AutorizacaoNegadaError(papel, acao);
  }
}
