/**
 * Papéis de acesso (RBAC, RNF-SEC-02). Fonte canônica do domínio; o enum `papel_usuario` do
 * banco espelha (há teste de drift). Usado pela autorização (US-03) e pela regra de 2FA (US-02).
 */

export const PAPEIS = ["dono", "gestor", "recepcao", "producao"] as const;

export type Papel = (typeof PAPEIS)[number];

/** Papéis administrativos: exigem 2FA (RNF-SEC-04 / ADR-006). */
export const PAPEIS_ADMIN = ["dono", "gestor"] as const satisfies readonly Papel[];

/** Se o papel exige MFA/2FA (AAL2) para acessar o sistema. */
export function exigeMfa(papel: Papel): boolean {
  return (PAPEIS_ADMIN as readonly Papel[]).includes(papel);
}
