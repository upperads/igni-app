import type { SessaoTenant } from "@/application/abrir-os";
import {
  type ClienteDetalhe,
  type ClienteView,
  detalheCliente,
  listarClientes,
} from "@/application/cliente";
import { database } from "@/infra/db/client";

/**
 * Composição dos clientes (I6). A camada web (`src/app`) importa daqui, nunca do `db` direto
 * (boundary guard). Leitura escopada ao tenant (RLS).
 */

export type { ClienteView, ClienteDetalhe };

export function listarClientesNoTenant(
  sessao: SessaoTenant,
  termo?: string,
): Promise<ClienteView[]> {
  return listarClientes(database, sessao, termo);
}

export function detalheClienteNoTenant(
  sessao: SessaoTenant,
  clienteId: string,
): Promise<ClienteDetalhe | null> {
  return detalheCliente(database, sessao, clienteId);
}
