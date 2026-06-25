import { desc, eq, ne } from "drizzle-orm";
import {
  abrirOS,
  type AbrirOSInput,
  type AbrirOSResult,
  type SessaoTenant,
} from "@/application/abrir-os";
import {
  executarTransicao,
  recallTransicao,
  type ResultadoExecucao,
} from "@/application/executar-transicao";
import { resolverContextoGate } from "@/application/orcamento";
import {
  ajustarPrioridade,
  type AjustarPrioridadeInput,
  destravar,
  recalcularPrioridade,
  type ResultadoPrioridade,
  travar,
  type TravarInput,
} from "@/application/triagem";
import { ESTADOS_OS, type EstadoOS, proximoBump, rotuloEstado } from "@/domain/os/estado";
import { calcularKpis, type Kpis, type Sinal, sinalDaOs } from "@/domain/os/painel";
import {
  diasRestantesAte,
  ordenarFila,
  type Prioridade,
  type Responsabilidade,
} from "@/domain/os/triagem";
import { database } from "@/infra/db/client";
import { cliente, entrada, equipamento, evento, os, usuario } from "@/infra/db/schema";
import { notificarPainel } from "@/infra/realtime/notificar";

/** Composição da OS: liga os casos de uso + as queries de leitura ao tenant corrente (withTenant). */

export async function abrirOsNoTenant(
  sessao: SessaoTenant,
  input: AbrirOSInput,
): Promise<AbrirOSResult> {
  const r = await abrirOS(database, sessao, input);
  await recalcularPrioridade(database, sessao, r.osId);
  await notificarPainel(sessao.tenantId);
  return r;
}

export interface TransicaoInput {
  osId: string;
  para: EstadoOS;
  motivo?: string;
}

export async function transicionarNoTenant(
  sessao: SessaoTenant,
  input: TransicaoInput,
): Promise<ResultadoExecucao> {
  // Gate REAL (ADR-008): o contexto vem do dado (orçamento aprovado + CQ aprovado), não cravado.
  const contexto = await resolverContextoGate(database, sessao, input.osId);
  const r = await executarTransicao(database, sessao, {
    osId: input.osId,
    para: input.para,
    contexto,
    motivo: input.motivo,
  });
  // Mudar de estado muda o "trabalho restante" → a prioridade pode mudar. Mantém o board honesto.
  if (r.ok) {
    await recalcularPrioridade(database, sessao, input.osId);
    await notificarPainel(sessao.tenantId);
  }
  return r;
}

export async function recallNoTenant(
  sessao: SessaoTenant,
  osId: string,
): Promise<ResultadoExecucao> {
  const r = await recallTransicao(database, sessao, osId);
  if (r.ok) {
    await recalcularPrioridade(database, sessao, osId);
    await notificarPainel(sessao.tenantId);
  }
  return r;
}

export async function ajustarPrioridadeNoTenant(
  sessao: SessaoTenant,
  input: AjustarPrioridadeInput,
): Promise<ResultadoPrioridade> {
  const r = await ajustarPrioridade(database, sessao, input);
  await notificarPainel(sessao.tenantId);
  return r;
}

export async function travarNoTenant(sessao: SessaoTenant, input: TravarInput): Promise<void> {
  await travar(database, sessao, input);
  await notificarPainel(sessao.tenantId);
}

export async function destravarNoTenant(sessao: SessaoTenant, osId: string): Promise<void> {
  await destravar(database, sessao, osId);
  await notificarPainel(sessao.tenantId);
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

export interface CardPainel {
  id: string;
  codigo: string;
  equipamento: string;
  responsavel: string | null;
  estado: EstadoOS;
  sinal: Sinal;
  prazoLabel: string;
  travado: boolean;
  travamentoResponsabilidade: Responsabilidade | null;
  /** Destino do "bump" (único passo adiante) ou null se há decisão/fim. */
  proximoBump: EstadoOS | null;
}

export interface EtapaPainel {
  estado: EstadoOS;
  rotulo: string;
  cards: CardPainel[];
}

export interface PainelDados {
  kpis: Kpis;
  etapas: EtapaPainel[];
}

/** Ref curta da OS até existir número sequencial por tenant (follow-up). */
function refCurta(id: string): string {
  return id.slice(0, 8);
}

function prazoLabel(dias: number | null): string {
  if (dias === null) {
    return "—";
  }
  if (dias < 0) {
    return `atrasado ${-dias}d`;
  }
  if (dias === 0) {
    return "hoje";
  }
  return `${dias}d`;
}

/**
 * Painel de gestão (US-09/11): OS ativas agrupadas por etapa (na ordem da linha de produção), cada
 * uma com seu sinal de triagem, mais os KPIs com o atraso separando a culpa. `agora` é injetado.
 */
export async function listarPainel(
  sessao: SessaoTenant,
  agora: Date = new Date(),
): Promise<PainelDados> {
  const linhas = await database.withTenant(sessao.tenantId, (tx) =>
    tx
      .select({
        id: os.id,
        equipamento: equipamento.tipo,
        responsavel: usuario.nome,
        estado: os.estado,
        prioridade: os.prioridade,
        travado: os.travado,
        travamentoResponsabilidade: os.travamentoResponsabilidade,
        prazoPrometido: os.prazoPrometido,
        criadoEm: os.createdAt,
      })
      .from(os)
      .innerJoin(equipamento, eq(equipamento.id, os.equipamentoId))
      .leftJoin(usuario, eq(usuario.id, os.responsavelId))
      .where(ne(os.estado, "entregue")),
  );

  const enriquecidas = linhas.map((l) => {
    const diasRestantes = diasRestantesAte(l.prazoPrometido, agora);
    return {
      ...l,
      diasRestantes,
      sinal: sinalDaOs({ prioridade: l.prioridade, travado: l.travado, diasRestantes }),
    };
  });

  const kpis = calcularKpis(
    enriquecidas.map((l) => ({
      prioridade: l.prioridade,
      travado: l.travado,
      travamentoResponsabilidade: l.travamentoResponsabilidade,
      estado: l.estado,
      diasRestantes: l.diasRestantes,
    })),
  );

  const etapas: EtapaPainel[] = ESTADOS_OS.filter((e) => e !== "entregue")
    .map((estado) => ({
      estado,
      rotulo: rotuloEstado(estado),
      cards: enriquecidas
        .filter((l) => l.estado === estado)
        .map<CardPainel>((l) => ({
          id: l.id,
          codigo: refCurta(l.id),
          equipamento: l.equipamento,
          responsavel: l.responsavel,
          estado: l.estado,
          sinal: l.sinal,
          prazoLabel: prazoLabel(l.diasRestantes),
          travado: l.travado,
          travamentoResponsabilidade: l.travamentoResponsabilidade,
          proximoBump: proximoBump(l.estado),
        })),
    }))
    .filter((etapa) => etapa.cards.length > 0);

  return { kpis, etapas };
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
