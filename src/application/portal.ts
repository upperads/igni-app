import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { podeDecidir, type StatusOrcamento } from "@/domain/orcamento/orcamento";
import type { Database } from "@/infra/db/connection";
import { evento, orcamento, os } from "@/infra/db/schema";

/**
 * Portal público do cliente (M6 / ADR-012). Acesso por TOKEN, sem sessão. Resolução em DUAS ETAPAS:
 * (1) uma leitura privilegiada MÍNIMA por `token_hash` (bypass RLS, retorna só o indispensável);
 * (2) tudo o mais escopado por `withTenant`, com a RLS de volta. O token abre SÓ a sua OS.
 */

const ERRO_LINK = "Link inválido ou expirado.";

export interface TokenResolvido {
  tenantId: string;
  osId: string;
  orcamentoId: string;
  status: StatusOrcamento;
}

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Etapa 1: resolve o token na conexão PRIVILEGIADA (1 query indexada por token_hash UNIQUE; ≤1 linha).
 * O tenant vem do REGISTRO do token, nunca de input do usuário. Null se não existe ou expirou.
 */
export async function resolverToken(
  database: Database,
  token: string,
  agora: Date,
): Promise<TokenResolvido | null> {
  if (!token || token.length < 16) {
    return null;
  }
  const [row] = await database.db
    .select({
      tenantId: orcamento.tenantId,
      osId: orcamento.osId,
      orcamentoId: orcamento.id,
      status: orcamento.status,
      expira: orcamento.tokenExpiraEm,
    })
    .from(orcamento)
    .where(eq(orcamento.tokenHash, hash(token)))
    .limit(1);

  if (!row || !row.expira || row.expira.getTime() < agora.getTime()) {
    return null;
  }
  return { tenantId: row.tenantId, osId: row.osId, orcamentoId: row.orcamentoId, status: row.status };
}

export interface ResultadoPortalDecisao {
  ok: boolean;
  motivo?: string;
  /** Para a composição recalcular/notificar (só presente em sucesso). */
  tenantId?: string;
  osId?: string;
}

/** US-14 — cliente aprova pelo link. Idempotente: já aprovado = ok; já recusado = aviso. */
export async function aprovarPorToken(
  database: Database,
  token: string,
  agora: Date,
): Promise<ResultadoPortalDecisao> {
  const r = await resolverToken(database, token, agora);
  if (!r) {
    return { ok: false, motivo: ERRO_LINK };
  }
  return database.withTenant(r.tenantId, async (tx) => {
    const [orc] = await tx
      .select({ status: orcamento.status })
      .from(orcamento)
      .where(eq(orcamento.id, r.orcamentoId))
      .limit(1);
    if (!orc) {
      return { ok: false, motivo: ERRO_LINK };
    }
    if (!podeDecidir(orc.status)) {
      return orc.status === "aprovado"
        ? { ok: true, tenantId: r.tenantId, osId: r.osId }
        : { ok: false, motivo: "Este orçamento já foi respondido." };
    }
    await tx
      .update(orcamento)
      .set({ status: "aprovado", aprovadoEm: agora })
      .where(eq(orcamento.id, r.orcamentoId));
    return { ok: true, tenantId: r.tenantId, osId: r.osId };
  });
}

/** US-14 — cliente recusa pelo link: volta a OS a diagnóstico (renegociação). Idempotente. */
export async function recusarPorToken(
  database: Database,
  token: string,
  agora: Date,
): Promise<ResultadoPortalDecisao> {
  const r = await resolverToken(database, token, agora);
  if (!r) {
    return { ok: false, motivo: ERRO_LINK };
  }
  return database.withTenant(r.tenantId, async (tx) => {
    const [orc] = await tx
      .select({ status: orcamento.status })
      .from(orcamento)
      .where(eq(orcamento.id, r.orcamentoId))
      .limit(1);
    if (!orc) {
      return { ok: false, motivo: ERRO_LINK };
    }
    if (!podeDecidir(orc.status)) {
      return orc.status === "recusado"
        ? { ok: true, tenantId: r.tenantId, osId: r.osId }
        : { ok: false, motivo: "Este orçamento já foi respondido." };
    }
    await tx
      .update(orcamento)
      .set({ status: "recusado", recusadoEm: agora })
      .where(eq(orcamento.id, r.orcamentoId));

    const [ordem] = await tx.select({ estado: os.estado }).from(os).where(eq(os.id, r.osId)).limit(1);
    if (ordem?.estado === "aguardando_aprovacao") {
      await tx
        .update(os)
        .set({ estado: "diagnostico", entrouNoEstadoEm: agora })
        .where(eq(os.id, r.osId));
      await tx.insert(evento).values({
        tenantId: r.tenantId,
        osId: r.osId,
        deEstado: "aguardando_aprovacao",
        paraEstado: "diagnostico",
        porUsuarioId: null, // decisão do cliente pelo link (não há usuário interno)
        motivo: "Recusado pelo cliente (link)",
      });
    }
    return { ok: true, tenantId: r.tenantId, osId: r.osId };
  });
}
