import { asc, eq, sql } from "drizzle-orm";
import { ehCargoDono, exigeMfa, type Permissao, validarCargo } from "@/domain/auth/cargo";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { cargo, usuario } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/**
 * Cargos (P-1): CRUD escopado ao tenant (`withTenant` → RLS). Cargos de sistema têm permissões
 * travadas (só nome/exige2fa mudam, e mesmo assim o gatilho de 2FA manda). Validação de domínio
 * (`validarCargo`) roda ANTES do withTenant — o throw vira rejeição de Promise (contrato uniforme).
 */
export interface CargoView {
  id: string;
  nome: string;
  sistema: boolean;
  chao: boolean;
  exige2fa: boolean;
  permissoes: Permissao[];
}

export interface CargoInput {
  nome: string;
  chao: boolean;
  exige2fa: boolean;
  permissoes: Permissao[];
}

export function listarCargos(database: Database, sessao: SessaoTenant): Promise<CargoView[]> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const linhas = await tx
      .select({
        id: cargo.id, nome: cargo.nome, sistema: cargo.sistema,
        chao: cargo.chao, exige2fa: cargo.exige2fa, permissoes: cargo.permissoes,
      })
      .from(cargo)
      .orderBy(asc(cargo.nome));
    return linhas.map((l) => ({ ...l, permissoes: l.permissoes as Permissao[] }));
  });
}

export async function criarCargo(
  database: Database,
  sessao: SessaoTenant,
  input: CargoInput,
): Promise<{ id: string }> {
  validarCargo(input);
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [novo] = await tx
      .insert(cargo)
      .values({
        tenantId: sessao.tenantId,
        nome: input.nome.trim(),
        sistema: false,
        chao: input.chao,
        exige2fa: exigeMfa({ chao: input.chao, exige2fa: input.exige2fa, permissoes: input.permissoes }),
        permissoes: input.permissoes,
      })
      .returning({ id: cargo.id });
    return { id: novo!.id };
  });
}

export async function editarCargo(
  database: Database,
  sessao: SessaoTenant,
  id: string,
  input: CargoInput,
): Promise<void> {
  validarCargo(input);
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [alvo] = await tx.select({ sistema: cargo.sistema }).from(cargo).where(eq(cargo.id, id)).limit(1);
    if (!alvo) {
      throw new DadosInvalidosError("Cargo não encontrado.");
    }
    if (alvo.sistema) {
      throw new DadosInvalidosError("Cargo de sistema tem permissões fixas — só o nome pode mudar.");
    }
    await tx
      .update(cargo)
      .set({
        nome: input.nome.trim(),
        chao: input.chao,
        exige2fa: exigeMfa({ chao: input.chao, exige2fa: input.exige2fa, permissoes: input.permissoes }),
        permissoes: input.permissoes,
      })
      .where(eq(cargo.id, id));
  });
}

/**
 * Renomear vale para qualquer cargo (inclusive de sistema — só o nome), EXCETO o Dono: seu nome
 * é o identificador do gate `cargo:gerir` e nunca pode mudar (trava de domínio, não só de UI).
 */
export async function renomearCargo(
  database: Database,
  sessao: SessaoTenant,
  id: string,
  nome: string,
): Promise<void> {
  if (!nome.trim()) {
    throw new DadosInvalidosError("Dê um nome ao cargo.");
  }
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [alvo] = await tx.select({ nome: cargo.nome }).from(cargo).where(eq(cargo.id, id)).limit(1);
    if (!alvo) {
      throw new DadosInvalidosError("Cargo não encontrado.");
    }
    if (ehCargoDono(alvo.nome)) {
      throw new DadosInvalidosError("O cargo Dono não pode ser renomeado.");
    }
    await tx.update(cargo).set({ nome: nome.trim() }).where(eq(cargo.id, id));
  });
}

export async function excluirCargo(database: Database, sessao: SessaoTenant, id: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [alvo] = await tx.select({ sistema: cargo.sistema }).from(cargo).where(eq(cargo.id, id)).limit(1);
    if (!alvo) {
      throw new DadosInvalidosError("Cargo não encontrado.");
    }
    if (alvo.sistema) {
      throw new DadosInvalidosError("Cargo de sistema não pode ser excluído.");
    }
    await tx.delete(cargo).where(eq(cargo.id, id));
  });
}

/** Quantos usuários ATIVOS têm o cargo Dono (suporte ao "último Dono" — Piso 1). */
export function contarUsuariosComCargoDono(database: Database, sessao: SessaoTenant): Promise<number> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [row] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(usuario)
      .innerJoin(cargo, eq(cargo.id, usuario.cargoId))
      .where(sql`${cargo.nome} = 'Dono' AND ${usuario.desativadoEm} IS NULL`);
    return row?.n ?? 0;
  });
}
