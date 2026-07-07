import { eq } from "drizzle-orm";
import { type FormaPagamento, type StatusConta, validarBaixa, validarTransicaoConta } from "@/domain/financeiro/conta";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { contaReceber } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/** Conta a receber de uma OS (P-4a/P-4b): leitura + cancelamento + baixa. A criação vive no aprovarOrcamento. */
export interface ContaView {
  id: string;
  status: StatusConta;
  valorCentavos: number;
  formaPagamento: FormaPagamento | null;
  recebidoEm: Date | null;
}

/** A conta a receber da OS (via orçamento). Null se ainda não há (orçamento não aprovado). */
export function contaDaOs(database: Database, sessao: SessaoTenant, osId: string): Promise<ContaView | null> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [c] = await tx
      .select({
        id: contaReceber.id,
        status: contaReceber.status,
        valorCentavos: contaReceber.valorCentavos,
        formaPagamento: contaReceber.formaPagamento,
        recebidoEm: contaReceber.recebidoEm,
      })
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

/** Registra a baixa (aberta → recebida) com a forma e a data (=agora). Gate financeiro:gerir na action. */
export async function registrarRecebimento(
  database: Database,
  sessao: SessaoTenant,
  contaId: string,
  forma: string,
): Promise<void> {
  validarBaixa(forma);
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [c] = await tx.select({ status: contaReceber.status }).from(contaReceber).where(eq(contaReceber.id, contaId)).limit(1);
    if (!c) {
      throw new DadosInvalidosError("Conta não encontrada.");
    }
    validarTransicaoConta(c.status, "recebida");
    await tx
      .update(contaReceber)
      .set({ status: "recebida", formaPagamento: forma as FormaPagamento, recebidoEm: new Date() })
      .where(eq(contaReceber.id, contaId));
  });
}

/** Desfaz a baixa (recebida → aberta): limpa forma e data. Só de recebida. Gate financeiro:gerir na action. */
export function desfazerRecebimento(database: Database, sessao: SessaoTenant, contaId: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [c] = await tx.select({ status: contaReceber.status }).from(contaReceber).where(eq(contaReceber.id, contaId)).limit(1);
    if (!c) {
      throw new DadosInvalidosError("Conta não encontrada.");
    }
    validarTransicaoConta(c.status, "aberta");
    await tx
      .update(contaReceber)
      .set({ status: "aberta", formaPagamento: null, recebidoEm: null })
      .where(eq(contaReceber.id, contaId));
  });
}
