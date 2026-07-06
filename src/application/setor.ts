import { asc, eq, max } from "drizzle-orm";
import { validarSetor } from "@/domain/os/setor";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { estacao, setor } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/**
 * Gestão dos SETORES (P-5a): agrupam estações. CRUD escopado por tenant (withTenant → RLS). Remover
 * setor com estações é bloqueado (o dono move as estações antes). validarSetor roda ANTES do withTenant
 * (throw vira rejeição de Promise — contrato uniforme).
 */
export interface SetorView {
  id: string;
  nome: string;
  ordem: number;
}
export interface EstacaoDoSetor {
  id: string;
  nome: string;
  ordem: number;
  setorId: string | null;
}
export interface SetorComEstacoes {
  id: string;
  nome: string;
  ordem: number;
  estacoes: EstacaoDoSetor[];
}

export function listarSetores(database: Database, sessao: SessaoTenant): Promise<SetorView[]> {
  return database.withTenant(sessao.tenantId, (tx) =>
    tx.select({ id: setor.id, nome: setor.nome, ordem: setor.ordem }).from(setor).orderBy(asc(setor.ordem)),
  );
}

export function listarSetoresComEstacoes(database: Database, sessao: SessaoTenant): Promise<SetorComEstacoes[]> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const setores = await tx
      .select({ id: setor.id, nome: setor.nome, ordem: setor.ordem })
      .from(setor)
      .orderBy(asc(setor.ordem));
    const estacoes = await tx
      .select({ id: estacao.id, nome: estacao.nome, ordem: estacao.ordem, setorId: estacao.setorId })
      .from(estacao)
      .orderBy(asc(estacao.ordem));
    return setores.map((s) => ({
      ...s,
      estacoes: estacoes.filter((e) => e.setorId === s.id),
    }));
  });
}

export async function criarSetor(database: Database, sessao: SessaoTenant, nomeBruto: string): Promise<SetorView> {
  validarSetor({ nome: nomeBruto });
  const nome = nomeBruto.trim();
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [m] = await tx.select({ max: max(setor.ordem) }).from(setor);
    const ordem = (m?.max ?? 0) + 1;
    const [nova] = await tx
      .insert(setor)
      .values({ tenantId: sessao.tenantId, nome, ordem })
      .returning({ id: setor.id, nome: setor.nome, ordem: setor.ordem });
    return nova!;
  });
}

export async function renomearSetor(database: Database, sessao: SessaoTenant, id: string, nomeBruto: string): Promise<void> {
  validarSetor({ nome: nomeBruto });
  const nome = nomeBruto.trim();
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx.update(setor).set({ nome }).where(eq(setor.id, id));
  });
}

export function reordenarSetores(database: Database, sessao: SessaoTenant, idsNaOrdem: string[]): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    let i = 1;
    for (const id of idsNaOrdem) {
      await tx.update(setor).set({ ordem: i }).where(eq(setor.id, id));
      i += 1;
    }
  });
}

export function removerSetor(database: Database, sessao: SessaoTenant, id: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [comEstacao] = await tx.select({ id: estacao.id }).from(estacao).where(eq(estacao.setorId, id)).limit(1);
    if (comEstacao) {
      throw new DadosInvalidosError("Mova as estações antes de remover o setor.");
    }
    await tx.delete(setor).where(eq(setor.id, id));
  });
}

export function moverEstacao(database: Database, sessao: SessaoTenant, estacaoId: string, setorId: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [alvo] = await tx.select({ id: setor.id }).from(setor).where(eq(setor.id, setorId)).limit(1);
    if (!alvo) {
      throw new DadosInvalidosError("Setor não encontrado.");
    }
    await tx.update(estacao).set({ setorId }).where(eq(estacao.id, estacaoId));
  });
}
