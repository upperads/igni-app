import type { SessaoTenant } from "@/application/abrir-os";
import { cancelarConta, contaDaOs, type ContaView } from "@/application/conta";
import { database } from "@/infra/db/client";

/** Composição da conta a receber (P-4a). A web importa daqui. */
export type { ContaView };

export function contaDaOsNoTenant(sessao: SessaoTenant, osId: string): Promise<ContaView | null> {
  return contaDaOs(database, sessao, osId);
}
export function cancelarContaNoTenant(sessao: SessaoTenant, contaId: string): Promise<void> {
  return cancelarConta(database, sessao, contaId);
}
