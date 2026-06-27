import { count } from "drizzle-orm";
import type { Database } from "@/infra/db/connection";
import { estacao, os, usuario } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/**
 * Estado de implantação da oficina (I3/I4 — onboarding guiado). Responde "a oficina já saiu do
 * zero?" para o painel decidir entre o guia "Comece por aqui" e a operação normal. Tudo no tenant
 * corrente (RLS). Barato: três `count` numa transação.
 */
export interface EstadoImplantacao {
  /** Já convidou alguém além do próprio admin do onboarding. */
  temEquipe: boolean;
  /** Já tem ao menos uma estação configurada (vem do template; pode ter sido esvaziada). */
  temEstacoes: boolean;
  /** Já abriu ao menos uma OS (mesmo entregue) — a oficina começou a rodar. */
  temOs: boolean;
  /** Atalho: nada feito ainda além de criar a conta. */
  oficinaNova: boolean;
}

export function estadoImplantacao(
  database: Database,
  sessao: SessaoTenant,
): Promise<EstadoImplantacao> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [[u], [e], [o]] = await Promise.all([
      tx.select({ n: count() }).from(usuario),
      tx.select({ n: count() }).from(estacao),
      tx.select({ n: count() }).from(os),
    ]);

    const temEquipe = (u?.n ?? 0) > 1;
    const temEstacoes = (e?.n ?? 0) > 0;
    const temOs = (o?.n ?? 0) > 0;

    return { temEquipe, temEstacoes, temOs, oficinaNova: !temEquipe && !temOs };
  });
}
