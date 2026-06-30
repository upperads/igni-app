import { and, eq, inArray, sql } from "drizzle-orm";
import type { EstadoOS } from "@/domain/os/estado";
import type { Prioridade, Responsabilidade } from "@/domain/os/triagem";
import type { TipoItem } from "@/domain/orcamento/orcamento";
import type { Database, TenantTx } from "@/infra/db/connection";
import {
  cliente,
  entrada,
  equipamento,
  evento,
  orcamento,
  orcamentoItem,
  os,
  tenantContadorOs,
} from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/**
 * Seed de DEMONSTRAÇÃO (I5 — P2): preenche a oficina com um cenário de venda completo — OS por todos
 * os estados, com crítico/atraso/travado, orçamentos e histórico passado que ENCHE o relatório
 * (responsabilização + adoção do chão). Tudo marcado `is_demo` para o "Limpar demonstração" apagar
 * cirurgicamente, sem nunca sujar o banco real. Não filtra leitura: numa conta de demo, o dono QUER
 * ver o app cheio. Escreve direto (não simula transições) para poder datar eventos no passado e
 * deixar OS em estados finais — tudo escopado ao tenant (`withTenant` → RLS).
 */

const DIA = 86_400_000;

interface PassoHistorico {
  de: EstadoOS | null;
  para: EstadoOS;
  /** Dias atrás em que o passo ocorreu (para datar o evento). */
  diasAtras: number;
  origem?: "escritorio" | "chao" | "cliente";
  motivo?: string;
}

interface OsDemo {
  cliente: { nome: string; tipo: "frota" | "produtor" | "avulso"; whatsapp?: string };
  equipamento: { tipo: string; placa?: string; modeloMotor?: string; maquinaUnica?: boolean };
  modalidade: "so_usinagem" | "empresa_retira" | "ja_desmontado" | "patio_oficina";
  tipoServico: string;
  estadoFinal: EstadoOS;
  prioridade: Prioridade;
  /** Dias até o prazo a partir de hoje (negativo = atrasado). */
  prazoEmDias: number | null;
  travado?: { motivo: string; responsabilidade: Responsabilidade };
  cqAprovado?: boolean;
  orcamento?: { status: "enviado" | "aprovado" | "recusado"; itens: { tipo: TipoItem; descricao: string; valorCentavos: number }[] };
  historico: PassoHistorico[];
}

/**
 * O elenco da demonstração. Cobre os estados ativos do board, gera atraso/crítico/travado e deixa
 * OS entregues com histórico passado (alimenta o relatório). Datas são relativas a "hoje".
 */
const CENARIO: OsDemo[] = [
  {
    cliente: { nome: "Transportes Boi Bravo", tipo: "frota", whatsapp: "11999990001" },
    equipamento: { tipo: "Motor Scania DC13", placa: "RTA1A23", modeloMotor: "DC13 105" },
    modalidade: "empresa_retira",
    tipoServico: "Retífica completa",
    estadoFinal: "execucao",
    prioridade: "critica",
    prazoEmDias: 1,
    cqAprovado: false,
    orcamento: { status: "aprovado", itens: [
      { tipo: "peca", descricao: "Jogo de pistões", valorCentavos: 480_000 },
      { tipo: "mao_de_obra", descricao: "Retífica do bloco", valorCentavos: 320_000 },
    ] },
    historico: [
      { de: null, para: "aberta", diasAtras: 9 },
      { de: "aberta", para: "diagnostico", diasAtras: 8, origem: "chao" },
      { de: "diagnostico", para: "orcamento", diasAtras: 7, origem: "chao" },
      { de: "orcamento", para: "aguardando_aprovacao", diasAtras: 6 },
      { de: "aguardando_aprovacao", para: "execucao", diasAtras: 4, motivo: "Orçamento aprovado pelo cliente por telefone, registrado pela operação." },
    ],
  },
  {
    cliente: { nome: "Fazenda Santa Lúcia", tipo: "produtor", whatsapp: "11999990002" },
    equipamento: { tipo: "Motor MWM 4.10 TCA", modeloMotor: "4.10 TCA", maquinaUnica: true },
    modalidade: "patio_oficina",
    tipoServico: "Troca de bronzinas e retífica de virabrequim",
    estadoFinal: "aguardando_peca",
    prioridade: "alta",
    prazoEmDias: -2,
    travado: { motivo: "Bronzina 0,50 em falta — fornecedor entrega em 3 dias.", responsabilidade: "empresa" },
    orcamento: { status: "aprovado", itens: [
      { tipo: "peca", descricao: "Jogo de bronzinas 0,50", valorCentavos: 95_000 },
      { tipo: "mao_de_obra", descricao: "Retífica do virabrequim", valorCentavos: 180_000 },
    ] },
    historico: [
      { de: null, para: "aberta", diasAtras: 12 },
      { de: "aberta", para: "diagnostico", diasAtras: 11, origem: "chao" },
      { de: "diagnostico", para: "orcamento", diasAtras: 10 },
      { de: "orcamento", para: "aguardando_aprovacao", diasAtras: 9 },
      { de: "aguardando_aprovacao", para: "aguardando_peca", diasAtras: 7, origem: "chao", motivo: "Aprovado; aguardando peça." },
    ],
  },
  {
    cliente: { nome: "Auto Center Veloz", tipo: "avulso", whatsapp: "11999990003" },
    equipamento: { tipo: "Cabeçote VW AP 1.8", placa: "RTB2B34" },
    modalidade: "so_usinagem",
    tipoServico: "Plaina e teste de trinca",
    estadoFinal: "aguardando_aprovacao",
    prioridade: "normal",
    prazoEmDias: 3,
    orcamento: { status: "enviado", itens: [
      { tipo: "mao_de_obra", descricao: "Plaina de cabeçote", valorCentavos: 45_000 },
      { tipo: "mao_de_obra", descricao: "Teste de trinca", valorCentavos: 18_000 },
    ] },
    historico: [
      { de: null, para: "aberta", diasAtras: 4 },
      { de: "aberta", para: "diagnostico", diasAtras: 3, origem: "chao" },
      { de: "diagnostico", para: "orcamento", diasAtras: 2 },
      { de: "orcamento", para: "aguardando_aprovacao", diasAtras: 1 },
    ],
  },
  {
    cliente: { nome: "Locadora Pesada Sul", tipo: "frota", whatsapp: "11999990004" },
    equipamento: { tipo: "Motor Cummins ISX15", placa: "RTC3C45", modeloMotor: "ISX15" },
    modalidade: "empresa_retira",
    tipoServico: "Diagnóstico de perda de potência",
    estadoFinal: "diagnostico",
    prioridade: "alta",
    prazoEmDias: 5,
    historico: [
      { de: null, para: "aberta", diasAtras: 2 },
      { de: "aberta", para: "diagnostico", diasAtras: 1, origem: "chao" },
    ],
  },
  {
    cliente: { nome: "Mecânica do Zé", tipo: "avulso" },
    equipamento: { tipo: "Bloco GM 1.0 VHC", placa: "RTD4D56" },
    modalidade: "ja_desmontado",
    tipoServico: "Brunimento e medição",
    estadoFinal: "controle_qualidade",
    prioridade: "normal",
    prazoEmDias: 2,
    cqAprovado: false,
    orcamento: { status: "aprovado", itens: [
      { tipo: "mao_de_obra", descricao: "Brunimento dos cilindros", valorCentavos: 60_000 },
    ] },
    historico: [
      { de: null, para: "aberta", diasAtras: 8 },
      { de: "aberta", para: "diagnostico", diasAtras: 7, origem: "chao" },
      { de: "diagnostico", para: "orcamento", diasAtras: 6 },
      { de: "orcamento", para: "aguardando_aprovacao", diasAtras: 5 },
      { de: "aguardando_aprovacao", para: "execucao", diasAtras: 4, motivo: "Orçamento aprovado pelo cliente pessoalmente, registrado pela operação." },
      { de: "execucao", para: "controle_qualidade", diasAtras: 1, origem: "chao" },
    ],
  },
  {
    cliente: { nome: "Frota Agro Oeste", tipo: "frota", whatsapp: "11999990006" },
    equipamento: { tipo: "Motor John Deere 6068", modeloMotor: "PowerTech 6068" },
    modalidade: "patio_oficina",
    tipoServico: "Retífica completa",
    estadoFinal: "pronta",
    prioridade: "normal",
    prazoEmDias: 0,
    cqAprovado: true,
    orcamento: { status: "aprovado", itens: [
      { tipo: "peca", descricao: "Kit retífica completo", valorCentavos: 720_000 },
      { tipo: "mao_de_obra", descricao: "Montagem e teste", valorCentavos: 250_000 },
    ] },
    historico: [
      { de: null, para: "aberta", diasAtras: 20 },
      { de: "aberta", para: "diagnostico", diasAtras: 19, origem: "chao" },
      { de: "diagnostico", para: "orcamento", diasAtras: 18 },
      { de: "orcamento", para: "aguardando_aprovacao", diasAtras: 17 },
      { de: "aguardando_aprovacao", para: "execucao", diasAtras: 14, motivo: "Orçamento aprovado pelo cliente por WhatsApp, registrado pela operação." },
      { de: "execucao", para: "controle_qualidade", diasAtras: 3, origem: "chao" },
      { de: "controle_qualidade", para: "pronta", diasAtras: 1, origem: "chao" },
    ],
  },
  {
    cliente: { nome: "Oficina Irmãos Lima", tipo: "avulso", whatsapp: "11999990007" },
    equipamento: { tipo: "Cabeçote Fiat Fire 1.4", placa: "RTE5E67" },
    modalidade: "so_usinagem",
    tipoServico: "Retífica de sede de válvula",
    estadoFinal: "entregue",
    prioridade: "normal",
    prazoEmDias: -1,
    cqAprovado: true,
    orcamento: { status: "aprovado", itens: [
      { tipo: "mao_de_obra", descricao: "Retífica de sedes", valorCentavos: 70_000 },
    ] },
    historico: [
      { de: null, para: "aberta", diasAtras: 16 },
      { de: "aberta", para: "diagnostico", diasAtras: 15, origem: "chao" },
      { de: "diagnostico", para: "orcamento", diasAtras: 14 },
      { de: "orcamento", para: "aguardando_aprovacao", diasAtras: 13 },
      { de: "aguardando_aprovacao", para: "execucao", diasAtras: 10, motivo: "Orçamento aprovado pelo cliente por telefone, registrado pela operação." },
      { de: "execucao", para: "controle_qualidade", diasAtras: 6, origem: "chao" },
      { de: "controle_qualidade", para: "execucao", diasAtras: 5, origem: "chao", motivo: "Reprovado no CQ: folga fora de medida (retrabalho)." },
      { de: "execucao", para: "controle_qualidade", diasAtras: 4, origem: "chao" },
      { de: "controle_qualidade", para: "pronta", diasAtras: 3, origem: "chao" },
      { de: "pronta", para: "entregue", diasAtras: 2, origem: "chao" },
    ],
  },
  {
    cliente: { nome: "Distribuidora Norte", tipo: "frota", whatsapp: "11999990008" },
    equipamento: { tipo: "Motor Volvo D13", placa: "RTF6F78", modeloMotor: "D13" },
    modalidade: "empresa_retira",
    tipoServico: "Retífica completa",
    estadoFinal: "entregue",
    prioridade: "normal",
    prazoEmDias: -3,
    cqAprovado: true,
    orcamento: { status: "aprovado", itens: [
      { tipo: "peca", descricao: "Camisas e pistões", valorCentavos: 560_000 },
      { tipo: "mao_de_obra", descricao: "Retífica e montagem", valorCentavos: 340_000 },
    ] },
    historico: [
      { de: null, para: "aberta", diasAtras: 25 },
      { de: "aberta", para: "diagnostico", diasAtras: 24, origem: "chao" },
      { de: "diagnostico", para: "orcamento", diasAtras: 23 },
      { de: "orcamento", para: "aguardando_aprovacao", diasAtras: 22 },
      { de: "aguardando_aprovacao", para: "aguardando_peca", diasAtras: 20, motivo: "Aprovado; aguardando peça importada." },
      { de: "aguardando_peca", para: "execucao", diasAtras: 12, origem: "chao", motivo: "Peça chegou." },
      { de: "execucao", para: "controle_qualidade", diasAtras: 5, origem: "chao" },
      { de: "controle_qualidade", para: "pronta", diasAtras: 3, origem: "chao" },
      { de: "pronta", para: "entregue", diasAtras: 2, origem: "chao" },
    ],
  },
];

/** Próximo número de OS do tenant (race-safe), igual ao caminho de produção (ADR-011). */
async function proximoNumero(tx: TenantTx, tenantId: string): Promise<number> {
  await tx.insert(tenantContadorOs).values({ tenantId }).onConflictDoNothing();
  const [linha] = await tx
    .update(tenantContadorOs)
    .set({ proximo: sql`${tenantContadorOs.proximo} + 1` })
    .where(eq(tenantContadorOs.tenantId, tenantId))
    .returning({ proximo: tenantContadorOs.proximo });
  return linha!.proximo - 1;
}

export interface SeedResult {
  osCriadas: number;
}

/** True se a oficina já tem OS de demonstração (para a UI alternar preencher/limpar). */
export async function temDemonstracao(database: Database, sessao: SessaoTenant): Promise<boolean> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [linha] = await tx
      .select({ id: os.id })
      .from(os)
      .where(eq(os.isDemo, true))
      .limit(1);
    return Boolean(linha);
  });
}

/**
 * Preenche a oficina com o cenário de demonstração. Idempotente no sentido prático: se já houver
 * demo, não duplica (a UI só oferece "preencher" quando não há). `agora` é injetado (testável).
 */
export async function semearDemonstracao(
  database: Database,
  sessao: SessaoTenant,
  agora: Date = new Date(),
): Promise<SeedResult> {
  const base = agora.getTime();
  return database.withTenant(sessao.tenantId, async (tx) => {
    let osCriadas = 0;
    for (const item of CENARIO) {
      const [cl] = await tx
        .insert(cliente)
        .values({
          tenantId: sessao.tenantId,
          nome: item.cliente.nome,
          tipo: item.cliente.tipo,
          contatoWhatsapp: item.cliente.whatsapp ?? null,
        })
        .returning({ id: cliente.id });

      const [eq] = await tx
        .insert(equipamento)
        .values({
          tenantId: sessao.tenantId,
          clienteId: cl!.id,
          tipo: item.equipamento.tipo,
          placa: item.equipamento.placa ?? null,
          modeloMotor: item.equipamento.modeloMotor ?? null,
          maquinaUnica: item.equipamento.maquinaUnica ?? false,
        })
        .returning({ id: equipamento.id });

      const [en] = await tx
        .insert(entrada)
        .values({ tenantId: sessao.tenantId, clienteId: cl!.id, modalidade: item.modalidade })
        .returning({ id: entrada.id });

      const numero = await proximoNumero(tx, sessao.tenantId);
      const prazo =
        item.prazoEmDias === null
          ? null
          : new Date(base + item.prazoEmDias * DIA).toISOString().slice(0, 10);
      const entrouEm = new Date(base - (item.historico.at(-1)?.diasAtras ?? 0) * DIA);

      const [ordem] = await tx
        .insert(os)
        .values({
          tenantId: sessao.tenantId,
          numero,
          entradaId: en!.id,
          equipamentoId: eq!.id,
          responsavelId: sessao.usuarioId,
          tipoServico: item.tipoServico,
          estado: item.estadoFinal,
          prioridade: item.prioridade,
          travado: Boolean(item.travado),
          travamentoMotivo: item.travado?.motivo ?? null,
          travamentoResponsabilidade: item.travado?.responsabilidade ?? null,
          cqAprovado: item.cqAprovado ?? false,
          prazoPrometido: prazo,
          entrouNoEstadoEm: entrouEm,
          isDemo: true,
        })
        .returning({ id: os.id });

      for (const passo of item.historico) {
        await tx.insert(evento).values({
          tenantId: sessao.tenantId,
          osId: ordem!.id,
          deEstado: passo.de,
          paraEstado: passo.para,
          porUsuarioId: sessao.usuarioId,
          motivo: passo.motivo ?? null,
          origem: passo.origem ?? "escritorio",
          em: new Date(base - passo.diasAtras * DIA),
          isDemo: true,
        });
      }

      if (item.orcamento) {
        const [orc] = await tx
          .insert(orcamento)
          .values({
            tenantId: sessao.tenantId,
            osId: ordem!.id,
            status: item.orcamento.status,
            enviadoEm: new Date(base - 6 * DIA),
            aprovadoEm: item.orcamento.status === "aprovado" ? new Date(base - 4 * DIA) : null,
            recusadoEm: item.orcamento.status === "recusado" ? new Date(base - 4 * DIA) : null,
          })
          .returning({ id: orcamento.id });
        await tx.insert(orcamentoItem).values(
          item.orcamento.itens.map((i) => ({
            tenantId: sessao.tenantId,
            orcamentoId: orc!.id,
            tipo: i.tipo,
            descricao: i.descricao,
            valorCentavos: i.valorCentavos,
            markupPct: 0,
          })),
        );
      }

      osCriadas += 1;
    }
    return { osCriadas };
  });
}

/**
 * Apaga TUDO que é de demonstração, na ordem das FKs: orçamento/itens/eventos caem por cascade ao
 * deletar a OS; depois removemos a entrada, o equipamento e o cliente órfãos da demo. Idempotente.
 * Só toca em `is_demo` — nunca em dado real.
 */
export async function limparDemonstracao(database: Database, sessao: SessaoTenant): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const osDemo = await tx.select({ id: os.id, entradaId: os.entradaId, equipamentoId: os.equipamentoId })
      .from(os)
      .where(eq(os.isDemo, true));
    if (osDemo.length === 0) {
      return;
    }
    const osIds = osDemo.map((o) => o.id);
    const entradaIds = [...new Set(osDemo.map((o) => o.entradaId))];
    const equipIds = [...new Set(osDemo.map((o) => o.equipamentoId))];

    // Clientes da demo = donos dos equipamentos da demo (cada equipamento tem um cliente).
    const equips = await tx
      .select({ clienteId: equipamento.clienteId })
      .from(equipamento)
      .where(inArray(equipamento.id, equipIds));
    const clienteIds = [...new Set(equips.map((e) => e.clienteId))];

    // OS primeiro (cascade limpa orçamento, itens e eventos). Depois os agregados órfãos.
    await tx.delete(os).where(and(eq(os.isDemo, true), inArray(os.id, osIds)));
    await tx.delete(entrada).where(inArray(entrada.id, entradaIds));
    await tx.delete(equipamento).where(inArray(equipamento.id, equipIds));
    if (clienteIds.length > 0) {
      await tx.delete(cliente).where(inArray(cliente.id, clienteIds));
    }
  });
}
