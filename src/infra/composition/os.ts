import { desc, eq } from "drizzle-orm";
import {
  abrirOS,
  type AbrirOSInput,
  type AbrirOSResult,
  type SessaoTenant,
} from "@/application/abrir-os";
import {
  executarTransicao,
  type ExecutarTransicaoInput,
  type ResultadoExecucao,
} from "@/application/executar-transicao";
import type { EstadoOS } from "@/domain/os/estado";
import { database } from "@/infra/db/client";
import { cliente, entrada, equipamento, evento, os } from "@/infra/db/schema";

/** Composição da OS: liga os casos de uso + as queries de leitura ao tenant corrente (withTenant). */

export function abrirOsNoTenant(sessao: SessaoTenant, input: AbrirOSInput): Promise<AbrirOSResult> {
  return abrirOS(database, sessao, input);
}

export function transicionarNoTenant(
  sessao: SessaoTenant,
  input: ExecutarTransicaoInput,
): Promise<ResultadoExecucao> {
  return executarTransicao(database, sessao, input);
}

export interface ItemListaOs {
  id: string;
  estado: EstadoOS;
  equipamento: string;
  clienteNome: string;
  criadoEm: Date;
}

export function listarOs(sessao: SessaoTenant): Promise<ItemListaOs[]> {
  return database.withTenant(sessao.tenantId, (tx) =>
    tx
      .select({
        id: os.id,
        estado: os.estado,
        equipamento: equipamento.tipo,
        clienteNome: cliente.nome,
        criadoEm: os.createdAt,
      })
      .from(os)
      .innerJoin(equipamento, eq(equipamento.id, os.equipamentoId))
      .innerJoin(entrada, eq(entrada.id, os.entradaId))
      .innerJoin(cliente, eq(cliente.id, entrada.clienteId))
      .orderBy(desc(os.createdAt)),
  );
}

export interface EventoOs {
  deEstado: EstadoOS | null;
  paraEstado: EstadoOS;
  motivo: string | null;
  em: Date;
}

export interface DetalheOs {
  id: string;
  estado: EstadoOS;
  tipoServico: string | null;
  prazoPrometido: string | null;
  entrouNoEstadoEm: Date;
  equipamento: { tipo: string; placa: string | null; chassi: string | null; modeloMotor: string | null };
  cliente: { nome: string; tipo: string };
  eventos: EventoOs[];
}

export async function detalheOs(sessao: SessaoTenant, osId: string): Promise<DetalheOs | null> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [linha] = await tx
      .select({
        id: os.id,
        estado: os.estado,
        tipoServico: os.tipoServico,
        prazoPrometido: os.prazoPrometido,
        entrouNoEstadoEm: os.entrouNoEstadoEm,
        equipTipo: equipamento.tipo,
        placa: equipamento.placa,
        chassi: equipamento.chassi,
        modeloMotor: equipamento.modeloMotor,
        clienteNome: cliente.nome,
        clienteTipo: cliente.tipo,
      })
      .from(os)
      .innerJoin(equipamento, eq(equipamento.id, os.equipamentoId))
      .innerJoin(entrada, eq(entrada.id, os.entradaId))
      .innerJoin(cliente, eq(cliente.id, entrada.clienteId))
      .where(eq(os.id, osId))
      .limit(1);

    if (!linha) {
      return null;
    }

    const eventos = await tx
      .select({
        deEstado: evento.deEstado,
        paraEstado: evento.paraEstado,
        motivo: evento.motivo,
        em: evento.em,
      })
      .from(evento)
      .where(eq(evento.osId, osId))
      .orderBy(desc(evento.em));

    return {
      id: linha.id,
      estado: linha.estado,
      tipoServico: linha.tipoServico,
      prazoPrometido: linha.prazoPrometido,
      entrouNoEstadoEm: linha.entrouNoEstadoEm,
      equipamento: {
        tipo: linha.equipTipo,
        placa: linha.placa,
        chassi: linha.chassi,
        modeloMotor: linha.modeloMotor,
      },
      cliente: { nome: linha.clienteNome, tipo: linha.clienteTipo },
      eventos,
    };
  });
}
