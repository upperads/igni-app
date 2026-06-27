import { eq, sql } from "drizzle-orm";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database, TenantTx } from "@/infra/db/connection";
import { cliente, entrada, equipamento, evento, os, tenantContadorOs } from "@/infra/db/schema";

/** Próximo número de OS do tenant (ADR-011). Race-safe: o UPDATE...RETURNING trava a linha do contador. */
async function proximoNumeroOs(tx: TenantTx, tenantId: string): Promise<number> {
  await tx.insert(tenantContadorOs).values({ tenantId }).onConflictDoNothing();
  const [linha] = await tx
    .update(tenantContadorOs)
    .set({ proximo: sql`${tenantContadorOs.proximo} + 1` })
    .where(eq(tenantContadorOs.tenantId, tenantId))
    .returning({ proximo: tenantContadorOs.proximo });
  return linha!.proximo - 1;
}

/** Sessão autenticada já resolvida (tenant + usuário corrente). */
export interface SessaoTenant {
  tenantId: string;
  usuarioId: string;
}

export interface AbrirOSInput {
  cliente: {
    nome: string;
    contatoWhatsapp?: string | null;
    tipo: "frota" | "produtor" | "avulso";
  };
  equipamento: {
    tipo: string;
    placa?: string | null;
    chassi?: string | null;
    modeloMotor?: string | null;
    maquinaUnica?: boolean;
  };
  entrada: {
    modalidade: "so_usinagem" | "empresa_retira" | "ja_desmontado";
    pecasRecebidas?: unknown;
    fotos?: unknown;
  };
  tipoServico?: string | null;
}

export interface AbrirOSResult {
  osId: string;
  clienteId: string;
  equipamentoId: string;
  entradaId: string;
}

/**
 * US-04 — abre uma OS rastreável: cria cliente + equipamento + entrada + a OS (estado `aberta`) e
 * grava o EVENTO de abertura, tudo numa transação ESCOPADA AO TENANT (`withTenant` → RLS ativa).
 * Diferente do onboarding (privilegiado/pré-tenant), aqui já há um tenant corrente na sessão.
 */
export async function abrirOS(
  database: Database,
  sessao: SessaoTenant,
  input: AbrirOSInput,
): Promise<AbrirOSResult> {
  const nomeCliente = input.cliente.nome.trim();
  const tipoEquipamento = input.equipamento.tipo.trim();
  if (!nomeCliente) {
    throw new DadosInvalidosError("Nome do cliente é obrigatório.");
  }
  if (!tipoEquipamento) {
    throw new DadosInvalidosError("Tipo do equipamento é obrigatório.");
  }

  return database.withTenant(sessao.tenantId, async (tx) => {
    const [cl] = await tx
      .insert(cliente)
      .values({
        tenantId: sessao.tenantId,
        nome: nomeCliente,
        contatoWhatsapp: input.cliente.contatoWhatsapp,
        tipo: input.cliente.tipo,
      })
      .returning({ id: cliente.id });

    const [equip] = await tx
      .insert(equipamento)
      .values({
        tenantId: sessao.tenantId,
        clienteId: cl!.id,
        tipo: tipoEquipamento,
        placa: input.equipamento.placa,
        chassi: input.equipamento.chassi,
        modeloMotor: input.equipamento.modeloMotor,
        maquinaUnica: input.equipamento.maquinaUnica ?? false,
      })
      .returning({ id: equipamento.id });

    const [en] = await tx
      .insert(entrada)
      .values({
        tenantId: sessao.tenantId,
        clienteId: cl!.id,
        modalidade: input.entrada.modalidade,
        pecasRecebidas: input.entrada.pecasRecebidas,
        fotos: input.entrada.fotos,
      })
      .returning({ id: entrada.id });

    const numero = await proximoNumeroOs(tx, sessao.tenantId);
    const [ordem] = await tx
      .insert(os)
      .values({
        tenantId: sessao.tenantId,
        numero,
        entradaId: en!.id,
        equipamentoId: equip!.id,
        tipoServico: input.tipoServico,
        responsavelId: sessao.usuarioId,
        estado: "aberta",
      })
      .returning({ id: os.id });

    await tx.insert(evento).values({
      tenantId: sessao.tenantId,
      osId: ordem!.id,
      deEstado: null,
      paraEstado: "aberta",
      porUsuarioId: sessao.usuarioId,
      motivo: "OS aberta",
    });

    return { osId: ordem!.id, clienteId: cl!.id, equipamentoId: equip!.id, entradaId: en!.id };
  });
}
