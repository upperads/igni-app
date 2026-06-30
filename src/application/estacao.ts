import { asc, eq, max } from "drizzle-orm";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { estacao, os } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/**
 * Gestão das estações do setor (I2 — Fase de Implantação). As estações nascem do template do ramo
 * no onboarding (`criarOficina`); aqui a oficina as VÊ e AJUSTA: renomear, reordenar, adicionar,
 * remover. Tudo escopado ao tenant corrente (`withTenant` aplica a RLS). Configurável por tenant
 * sem novo deploy — alinhado às "decisões configuráveis" do CLAUDE.md.
 */

export interface EstacaoView {
  id: string;
  nome: string;
  ordem: number;
}

/** Lista as estações do tenant, na ordem do fluxo. */
export function listarEstacoes(database: Database, sessao: SessaoTenant): Promise<EstacaoView[]> {
  return database.withTenant(sessao.tenantId, (tx) =>
    tx
      .select({ id: estacao.id, nome: estacao.nome, ordem: estacao.ordem })
      .from(estacao)
      .orderBy(asc(estacao.ordem)),
  );
}

/** Adiciona uma estação ao fim do fluxo (ordem = maior atual + 1). */
export function adicionarEstacao(
  database: Database,
  sessao: SessaoTenant,
  nomeBruto: string,
): Promise<EstacaoView> {
  const nome = nomeBruto.trim();
  if (!nome) {
    throw new DadosInvalidosError("Dê um nome à estação.");
  }
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [m] = await tx.select({ max: max(estacao.ordem) }).from(estacao);
    const ordem = (m?.max ?? 0) + 1;
    const [nova] = await tx
      .insert(estacao)
      .values({ tenantId: sessao.tenantId, nome, ordem })
      .returning({ id: estacao.id, nome: estacao.nome, ordem: estacao.ordem });
    return nova!;
  });
}

/** Renomeia uma estação do tenant. */
export function renomearEstacao(
  database: Database,
  sessao: SessaoTenant,
  estacaoId: string,
  nomeBruto: string,
): Promise<void> {
  const nome = nomeBruto.trim();
  if (!nome) {
    throw new DadosInvalidosError("Dê um nome à estação.");
  }
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx.update(estacao).set({ nome }).where(eq(estacao.id, estacaoId));
  });
}

/**
 * Reordena as estações. Recebe a lista de ids na ordem desejada e reescreve `ordem` (1..N).
 * Idempotente; ids fora do tenant são filtrados pela RLS (o UPDATE não acha a linha).
 */
export function reordenarEstacoes(
  database: Database,
  sessao: SessaoTenant,
  idsNaOrdem: string[],
): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    let i = 1;
    for (const id of idsNaOrdem) {
      await tx.update(estacao).set({ ordem: i }).where(eq(estacao.id, id));
      i += 1;
    }
  });
}

/**
 * Atribui (ou desatribui) a ESTAÇÃO FÍSICA de uma OS (I7): em qual posto do chão o trabalho está
 * fisicamente. Diferente do ESTADO (lógico, da máquina de estados). `estacaoId = null` desatribui.
 * Valida que a estação pertence ao tenant (RLS já protege; a checagem dá erro claro em vez de FK).
 */
export function atribuirEstacaoAOs(
  database: Database,
  sessao: SessaoTenant,
  osId: string,
  estacaoId: string | null,
): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    if (estacaoId !== null) {
      const [est] = await tx
        .select({ id: estacao.id })
        .from(estacao)
        .where(eq(estacao.id, estacaoId))
        .limit(1);
      if (!est) {
        throw new DadosInvalidosError("Estação não encontrada.");
      }
    }
    await tx.update(os).set({ estacaoId }).where(eq(os.id, osId));
  });
}

/**
 * Remove uma estação. Bloqueia se houver OS apontando para ela (FK lógica via `os.estacaoId`):
 * preservar a história importa mais que apagar. Sem OS vinculada, remove.
 */
export function removerEstacao(
  database: Database,
  sessao: SessaoTenant,
  estacaoId: string,
): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [emUso] = await tx
      .select({ id: os.id })
      .from(os)
      .where(eq(os.estacaoId, estacaoId))
      .limit(1);
    if (emUso) {
      throw new DadosInvalidosError(
        "Há OS nesta estação. Mova-as antes de remover, ou apenas renomeie.",
      );
    }
    await tx.delete(estacao).where(eq(estacao.id, estacaoId));
  });
}
