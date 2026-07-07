import { eq } from "drizzle-orm";
import { type StatusConta, validarTransicaoConta } from "@/domain/financeiro/conta";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { contaReceber } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/** Conta a receber de uma OS (P-4a): leitura + cancelamento. A criação vive no aprovarOrcamento. */
export interface ContaView {
  id: string;
  status: StatusConta;
  valorCentavos: number;
}

/** A conta a receber da OS (via orçamento). Null se ainda não há (orçamento não aprovado). */
export function contaDaOs(database: Database, sessao: SessaoTenant, osId: string): Promise<ContaView | null> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [c] = await tx
      .select({ id: contaReceber.id, status: contaReceber.status, valorCentavos: contaReceber.valorCentavos })
      .from(contaReceber)
      .where(eq(contaReceber.osId, osId))
      .limit(1);
    return c ?? null;
  });
}

/** Cancela a cobrança (aberta → cancelada). Só de aberta (validarTransicaoConta). Gestão/financeiro. */
export function cancelarConta(database: Database, sessao: SessaoTenant, contaId: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [c] = await tx.select({ status: contaReceber.status }).from(contaReceber).where(eq(contaReceber.id, contaId)).limit(1);
    if (!c) {
      throw new DadosInvalidosError("Conta não encontrada.");
    }
    validarTransicaoConta(c.status, "cancelada");
    await tx.update(contaReceber).set({ status: "cancelada" }).where(eq(contaReceber.id, contaId));
  });
}
