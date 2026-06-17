/** Tradução de erros do Postgres (postgres.js) para a aplicação, sem vazar shape do driver. */

/**
 * `23505` = unique_violation. Opcionalmente casa o nome da constraint.
 *
 * O Drizzle ENVOLVE o erro do driver (mensagem "Failed query: ..."), então o código/constraint
 * reais ficam em `err.cause`. Por isso percorremos a cadeia de `cause`.
 */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current != null && typeof current === "object"; depth += 1) {
    const e = current as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (e.code === "23505" && (constraint === undefined || e.constraint_name === constraint)) {
      return true;
    }
    current = e.cause;
  }
  return false;
}
