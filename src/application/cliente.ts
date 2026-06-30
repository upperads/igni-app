import { desc, eq, ilike, or, sql } from "drizzle-orm";
import type { TipoCliente } from "@/domain/os/cliente";
import type { EstadoOS } from "@/domain/os/estado";
import type { Database } from "@/infra/db/connection";
import { cliente, entrada, equipamento, os } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/**
 * Leitura de clientes (I6): a oficina passa a GERIR quem atende, não só criar cliente escondido no
 * "abrir OS". Lista com contagem de OS (o histórico do cliente), busca por nome/WhatsApp, e o detalhe
 * com as OS daquele cliente. Tudo no tenant corrente (RLS). Sem mutação aqui além do reuso em abrirOS.
 */

export interface ClienteView {
  id: string;
  nome: string;
  whatsapp: string | null;
  tipo: TipoCliente;
  totalOs: number;
  criadoEm: Date;
}

/** Lista clientes (com nº de OS), opcionalmente filtrando por um termo em nome ou WhatsApp. */
export function listarClientes(
  database: Database,
  sessao: SessaoTenant,
  termo?: string,
): Promise<ClienteView[]> {
  const t = (termo ?? "").trim();
  return database.withTenant(sessao.tenantId, (tx) => {
    const base = tx
      .select({
        id: cliente.id,
        nome: cliente.nome,
        whatsapp: cliente.contatoWhatsapp,
        tipo: cliente.tipo,
        criadoEm: cliente.createdAt,
        totalOs: sql<number>`count(distinct ${os.id})`.mapWith(Number),
      })
      .from(cliente)
      .leftJoin(entrada, eq(entrada.clienteId, cliente.id))
      .leftJoin(os, eq(os.entradaId, entrada.id))
      .groupBy(cliente.id)
      .orderBy(desc(cliente.createdAt));

    if (t.length > 0) {
      return base.where(
        or(ilike(cliente.nome, `%${t}%`), ilike(cliente.contatoWhatsapp, `%${t.replace(/\D/g, "")}%`)),
      );
    }
    return base;
  });
}

export interface OsDoCliente {
  id: string;
  numero: number;
  estado: EstadoOS;
  equipamento: string;
  criadoEm: Date;
}

export interface ClienteDetalhe extends ClienteView {
  os: OsDoCliente[];
}

/** Detalhe de um cliente: dados + as OS dele (o histórico). Null se não existe no tenant. */
export function detalheCliente(
  database: Database,
  sessao: SessaoTenant,
  clienteId: string,
): Promise<ClienteDetalhe | null> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [c] = await tx
      .select({
        id: cliente.id,
        nome: cliente.nome,
        whatsapp: cliente.contatoWhatsapp,
        tipo: cliente.tipo,
        criadoEm: cliente.createdAt,
      })
      .from(cliente)
      .where(eq(cliente.id, clienteId))
      .limit(1);
    if (!c) {
      return null;
    }

    const ordens = await tx
      .select({
        id: os.id,
        numero: os.numero,
        estado: os.estado,
        equipamento: equipamento.tipo,
        criadoEm: os.createdAt,
      })
      .from(os)
      .innerJoin(entrada, eq(entrada.id, os.entradaId))
      .innerJoin(equipamento, eq(equipamento.id, os.equipamentoId))
      .where(eq(entrada.clienteId, clienteId))
      .orderBy(desc(os.createdAt));

    return { ...c, totalOs: ordens.length, os: ordens };
  });
}
