import { eq } from "drizzle-orm";
import type { SessaoTenant } from "@/application/abrir-os";
import {
  bumpPorQuiosque,
  definirPin,
  gerarQuiosque,
  limparPin,
  listarQuiosques,
  type QuiosqueView,
  type ResultadoQuiosque,
  resolverQuiosque,
  revogarQuiosque,
} from "@/application/quiosque";
import type { EstadoOS } from "@/domain/os/estado";
import { proximoBump } from "@/domain/os/estado";
import { database } from "@/infra/db/client";
import { equipamento, estacao, os } from "@/infra/db/schema";
import { notificarPainel } from "@/infra/realtime/notificar";

export type { QuiosqueView };

/** Composição do quiosque: liga os casos de uso ao `database` + notifica o painel quando muda a OS. */

// --- Admin (sessão) ---
export function gerarQuiosqueNoTenant(sessao: SessaoTenant, estacaoId: string) {
  return gerarQuiosque(database, sessao, estacaoId);
}
export function revogarQuiosqueNoTenant(sessao: SessaoTenant, quiosqueId: string) {
  return revogarQuiosque(database, sessao, quiosqueId);
}
export function listarQuiosquesNoTenant(sessao: SessaoTenant) {
  return listarQuiosques(database, sessao);
}
export function definirPinNoTenant(sessao: SessaoTenant, usuarioId: string, pin: string) {
  return definirPin(database, sessao, usuarioId, pin);
}
export function limparPinNoTenant(sessao: SessaoTenant, usuarioId: string) {
  return limparPin(database, sessao, usuarioId);
}

// --- Público (token) ---
export interface CardQuiosque {
  id: string;
  numero: number;
  equipamento: string;
  estado: EstadoOS;
  proximoBump: EstadoOS | null;
  travado: boolean;
}
export interface DadosQuiosque {
  estacaoNome: string;
  cards: CardQuiosque[];
}

/** Resolve o quiosque por token/código — só diz se é válido (uso em rotas que precisam checar antes). */
export async function resolverQuiosquePublico(token: string) {
  return resolverQuiosque(database, token);
}

/** Lista as OS ATIVAS do setor do quiosque (escopo mínimo: só o setor). Null se quiosque inválido. */
export async function dadosQuiosque(token: string): Promise<DadosQuiosque | null> {
  const q = await resolverQuiosque(database, token);
  if (!q) {
    return null;
  }
  return database.withTenant(q.tenantId, async (tx) => {
    const [est] = await tx.select({ nome: estacao.nome }).from(estacao).where(eq(estacao.id, q.estacaoId)).limit(1);
    const linhas = await tx
      .select({
        id: os.id,
        numero: os.numero,
        equipamento: equipamento.tipo,
        estado: os.estado,
        travado: os.travado,
      })
      .from(os)
      .innerJoin(equipamento, eq(equipamento.id, os.equipamentoId))
      .where(eq(os.estacaoId, q.estacaoId));
    return {
      estacaoNome: est?.nome ?? "Setor",
      cards: linhas
        .filter((l) => l.estado !== "entregue")
        .map((l) => ({
          id: l.id,
          numero: l.numero,
          equipamento: l.equipamento,
          estado: l.estado,
          proximoBump: proximoBump(l.estado),
          travado: l.travado,
        })),
    };
  });
}

export async function bumpQuiosquePublico(
  token: string,
  osId: string,
  para: EstadoOS,
  pin: string,
): Promise<ResultadoQuiosque> {
  const r = await bumpPorQuiosque(database, token, osId, para, pin, new Date());
  if (r.ok) {
    const q = await resolverQuiosque(database, token);
    if (q) {
      await notificarPainel(q.tenantId);
    }
  }
  return r;
}
