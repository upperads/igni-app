import { desc, eq, ne } from "drizzle-orm";
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
import {
  ajustarPrioridade,
  type AjustarPrioridadeInput,
  destravar,
  recalcularPrioridade,
  type ResultadoPrioridade,
  travar,
  type TravarInput,
} from "@/application/triagem";
import type { EstadoOS } from "@/domain/os/estado";
import {
  ordenarFila,
  type Prioridade,
  type Responsabilidade,
} from "@/domain/os/triagem";
import { database } from "@/infra/db/client";
import { cliente, entrada, equipamento, evento, os } from "@/infra/db/schema";

/** Composição da OS: liga os casos de uso + as queries de leitura ao tenant corrente (withTenant). */

export async function abrirOsNoTenant(
  sessao: SessaoTenant,
  input: AbrirOSInput,
): Promise<AbrirOSResult> {
  const r = await abrirOS(database, sessao, input);
  await recalcularPrioridade(database, sessao, r.osId);
  return r;
}

export async function transicionarNoTenant(
  sessao: SessaoTenant,
  input: ExecutarTransicaoInput,
): Promise<ResultadoExecucao> {
  const r = await executarTransicao(database, sessao, input);
  // Mudar de estado muda o "trabalho restante" → a prioridade pode mudar. Mantém o board honesto.
  if (r.ok) {
    await recalcularPrioridade(database, sessao, input.osId);
  }
  return r;
}

export function ajustarPrioridadeNoTenant(
  sessao: SessaoTenant,
  input: AjustarPrioridadeInput,
): Promise<ResultadoPrioridade> {
  return ajustarPrioridade(database, sessao, input);
}

export function travarNoTenant(sessao: SessaoTenant, input: TravarInput): Promise<void> {
  return travar(database, sessao, input);
}

export function destravarNoTenant(sessao: SessaoTenant, osId: string): Promise<void> {
  return destravar(database, sessao, osId);
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

export interface ItemTriagem {
  id: string;
  equipamento: string;
  clienteNome: string;
  estado: EstadoOS;
  prioridade: Prioridade;
  score: number;
  travado: boolean;
  travamentoMotivo: string | null;
  travamentoResponsabilidade: Responsabilidade | null;
  criadoEm: Date;
}

/** Fila de triagem (US-07/08): OS ativas ordenadas por impacto, já com a regra da vez aplicada. */
export async function listarTriagem(sessao: SessaoTenant): Promise<ItemTriagem[]> {
  const linhas = await database.withTenant(sessao.tenantId, (tx) =>
    tx
      .select({
        id: os.id,
        equipamento: equipamento.tipo,
        clienteNome: cliente.nome,
        estado: os.estado,
        prioridade: os.prioridade,
        score: os.prioridadeScore,
        travado: os.travado,
        travamentoMotivo: os.travamentoMotivo,
        travamentoResponsabilidade: os.travamentoResponsabilidade,
        criadoEm: os.createdAt,
      })
      .from(os)
      .innerJoin(equipamento, eq(equipamento.id, os.equipamentoId))
      .innerJoin(entrada, eq(entrada.id, os.entradaId))
      .innerJoin(cliente, eq(cliente.id, entrada.clienteId))
      .where(ne(os.estado, "entregue")),
  );
  return ordenarFila(linhas);
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
  prioridade: Prioridade;
  prioridadeScore: number;
  prioridadeOverride: Prioridade | null;
  travado: boolean;
  travamentoMotivo: string | null;
  travamentoResponsabilidade: Responsabilidade | null;
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
        prioridade: os.prioridade,
        prioridadeScore: os.prioridadeScore,
        prioridadeOverride: os.prioridadeOverride,
        travado: os.travado,
        travamentoMotivo: os.travamentoMotivo,
        travamentoResponsabilidade: os.travamentoResponsabilidade,
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
      prioridade: linha.prioridade,
      prioridadeScore: linha.prioridadeScore,
      prioridadeOverride: linha.prioridadeOverride,
      travado: linha.travado,
      travamentoMotivo: linha.travamentoMotivo,
      travamentoResponsabilidade: linha.travamentoResponsabilidade,
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
