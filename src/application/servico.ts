import { asc, eq } from "drizzle-orm";
import { type TipoItem } from "@/domain/orcamento/orcamento";
import { aplicarReajuste, pctReajusteValido, validarServico } from "@/domain/orcamento/servico";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { servico } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/**
 * Catálogo de serviços (P-2): a oficina mantém sua tabela de preços. Fonte de SUGESTÃO — o orçamento
 * copia o serviço para uma linha editável (sem FK). Tudo escopado ao tenant (`withTenant` → RLS).
 * Gerido por quem edita orçamento (RBAC no boundary da action).
 */

export interface ServicoView {
  id: string;
  nome: string;
  tipo: TipoItem;
  valorCentavos: number;
  markupPct: number;
  ativo: boolean;
}

export interface ServicoInput {
  nome: string;
  tipo: TipoItem;
  valorCentavos: number;
  markupPct: number;
}

/** Lista os serviços do tenant (ativos por padrão; `incluirInativos` traz todos). Ordenado por nome. */
export function listarServicos(
  database: Database,
  sessao: SessaoTenant,
  opts?: { incluirInativos?: boolean },
): Promise<ServicoView[]> {
  return database.withTenant(sessao.tenantId, (tx) => {
    const base = tx
      .select({
        id: servico.id,
        nome: servico.nome,
        tipo: servico.tipo,
        valorCentavos: servico.valorCentavos,
        markupPct: servico.markupPct,
        ativo: servico.ativo,
      })
      .from(servico)
      .orderBy(asc(servico.nome));
    return opts?.incluirInativos ? base : base.where(eq(servico.ativo, true));
  });
}

/** Cria um serviço no catálogo do tenant. Valida nome/valor/markup. */
export function criarServico(
  database: Database,
  sessao: SessaoTenant,
  input: ServicoInput,
): Promise<{ id: string }> {
  validarServico(input);
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [novo] = await tx
      .insert(servico)
      .values({
        tenantId: sessao.tenantId,
        nome: input.nome.trim(),
        tipo: input.tipo,
        valorCentavos: input.valorCentavos,
        markupPct: input.markupPct,
      })
      .returning({ id: servico.id });
    return { id: novo!.id };
  });
}

/** Edita um serviço do tenant. Valida os campos. RLS garante que só o próprio tenant altera. */
export function editarServico(
  database: Database,
  sessao: SessaoTenant,
  id: string,
  input: ServicoInput,
): Promise<void> {
  validarServico(input);
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx
      .update(servico)
      .set({
        nome: input.nome.trim(),
        tipo: input.tipo,
        valorCentavos: input.valorCentavos,
        markupPct: input.markupPct,
      })
      .where(eq(servico.id, id));
  });
}

/** Desativa um serviço (some da escolha, preserva o histórico). */
export function desativarServico(database: Database, sessao: SessaoTenant, id: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx.update(servico).set({ ativo: false }).where(eq(servico.id, id));
  });
}

/** Reativa um serviço desativado. */
export function reativarServico(database: Database, sessao: SessaoTenant, id: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx.update(servico).set({ ativo: true }).where(eq(servico.id, id));
  });
}

/**
 * Reajuste em massa: aplica `pct`% sobre o valor de todos os serviços ATIVOS do tenant (conveniência
 * do aumento anual). Só toca o catálogo — nunca orçamentos já feitos. `afetados` = quantos mudaram.
 */
export async function reajustarPrecos(
  database: Database,
  sessao: SessaoTenant,
  pct: number,
): Promise<{ afetados: number }> {
  if (!pctReajusteValido(pct)) {
    throw new DadosInvalidosError("Percentual de reajuste inválido.");
  }
  return database.withTenant(sessao.tenantId, async (tx) => {
    const ativos = await tx
      .select({ id: servico.id, valorCentavos: servico.valorCentavos })
      .from(servico)
      .where(eq(servico.ativo, true));
    for (const s of ativos) {
      await tx
        .update(servico)
        .set({ valorCentavos: aplicarReajuste(s.valorCentavos, pct) })
        .where(eq(servico.id, s.id));
    }
    return { afetados: ativos.length };
  });
}
