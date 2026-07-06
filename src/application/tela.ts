import { randomBytes } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { hashToken } from "@/application/quiosque";
import { ALFABETO_CODIGO, gerarCodigoCurto } from "@/domain/os/quiosque";
import { type ModoTela, validarTela } from "@/domain/os/tela";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { estacao, setor, tela } from "@/infra/db/schema";
import { notificarPainel } from "@/infra/realtime/notificar";
import type { SessaoTenant } from "./abrir-os";

/** Sufixo aleatório do código curto (4 chars do alfabeto sem ambíguos), via crypto. */
function sufixoCodigo(): string {
  const bytes = randomBytes(4);
  return Array.from(bytes, (b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join("");
}

export interface TelaView {
  id: string;
  nome: string;
  modo: ModoTela;
  estacaoId: string | null;
  estacaoNome: string | null;
  setorId: string | null;
  setorNome: string | null;
  codigoCurto: string;
  ativo: boolean;
  ultimoUsoEm: Date | null;
}

export interface TelaInput {
  nome: string;
  modo: ModoTela;
  estacaoId: string | null;
  setorId: string | null;
}

/** Lista as telas do tenant (com nome da estação/setor e se está ativa) — pra tela de gestão. */
export function listarTelas(database: Database, sessao: SessaoTenant): Promise<TelaView[]> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const linhas = await tx
      .select({
        id: tela.id,
        nome: tela.nome,
        modo: tela.modo,
        estacaoId: tela.estacaoId,
        estacaoNome: estacao.nome,
        setorId: tela.setorId,
        setorNome: setor.nome,
        codigoCurto: tela.codigoCurto,
        revogadoEm: tela.revogadoEm,
        ultimoUsoEm: tela.ultimoUsoEm,
      })
      .from(tela)
      .leftJoin(estacao, eq(estacao.id, tela.estacaoId))
      .leftJoin(setor, eq(setor.id, tela.setorId))
      .orderBy(asc(tela.nome));
    return linhas.map((l) => ({
      id: l.id,
      nome: l.nome,
      modo: l.modo,
      estacaoId: l.estacaoId,
      estacaoNome: l.estacaoNome,
      setorId: l.setorId,
      setorNome: l.setorNome,
      codigoCurto: l.codigoCurto,
      ativo: l.revogadoEm === null,
      ultimoUsoEm: l.ultimoUsoEm,
    }));
  });
}

/**
 * Registra uma tela (dispositivo): cria o token forte (devolve o CRU uma vez p/ o QR), guarda só o
 * hash + código curto único. Valida ANTES do withTenant (throw → rejeição de Promise). Escopado (RLS).
 */
export async function registrarTela(
  database: Database,
  sessao: SessaoTenant,
  input: TelaInput,
): Promise<{ token: string; codigoCurto: string }> {
  validarTela(input);
  return database.withTenant(sessao.tenantId, async (tx) => {
    const token = randomBytes(32).toString("base64url");
    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      const codigoCurto = gerarCodigoCurto(input.nome, sufixoCodigo());
      try {
        await tx.insert(tela).values({
          tenantId: sessao.tenantId,
          nome: input.nome.trim(),
          modo: input.modo,
          estacaoId: input.estacaoId,
          setorId: input.setorId,
          tokenHash: hashToken(token),
          codigoCurto,
          criadoPor: sessao.usuarioId,
        });
        return { token, codigoCurto };
      } catch (err) {
        if (tentativa === 4) throw err;
      }
    }
    throw new DadosInvalidosError("Não foi possível registrar a tela. Tente de novo.");
  });
}

/** Troca o que a tela mostra (o coração do P-3) + dispara o ping para a TV reler. */
export async function configurarTela(
  database: Database,
  sessao: SessaoTenant,
  id: string,
  input: TelaInput,
): Promise<void> {
  validarTela(input);
  await database.withTenant(sessao.tenantId, async (tx) => {
    await tx
      .update(tela)
      .set({ nome: input.nome.trim(), modo: input.modo, estacaoId: input.estacaoId, setorId: input.setorId })
      .where(eq(tela.id, id));
  });
  await notificarPainel(sessao.tenantId);
}

/** Revoga (desliga) uma tela: mata o token na hora. RLS garante que só o próprio tenant revoga. */
export function revogarTela(database: Database, sessao: SessaoTenant, id: string): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx.update(tela).set({ revogadoEm: new Date() }).where(eq(tela.id, id));
  });
}

export interface TelaResolvida {
  tenantId: string;
  telaId: string;
  modo: ModoTela;
  estacaoId: string | null;
  setorId: string | null;
}

/**
 * Etapa PRIVILEGIADA mínima (espelha resolverQuiosque): resolve a tela por TOKEN (`token_hash`) OU
 * código curto. O tenant/modo/estação/setor vêm do REGISTRO, nunca do input. Null se revogada/inexistente.
 * Carimba `ultimo_uso_em` (best-effort). Usa `database.db` (fora do withTenant — o lookup atravessa
 * tenants por token; a leitura do painel depois abre withTenant no tenant resolvido).
 */
export async function resolverTelaPorToken(
  database: Database,
  tokenOuCodigo: string,
): Promise<TelaResolvida | null> {
  if (!tokenOuCodigo || tokenOuCodigo.length < 4) {
    return null;
  }
  const [porToken] = await database.db
    .select({
      id: tela.id,
      tenantId: tela.tenantId,
      modo: tela.modo,
      estacaoId: tela.estacaoId,
      setorId: tela.setorId,
      revogadoEm: tela.revogadoEm,
    })
    .from(tela)
    .where(eq(tela.tokenHash, hashToken(tokenOuCodigo)))
    .limit(1);
  const linha =
    porToken ??
    (
      await database.db
        .select({
          id: tela.id,
          tenantId: tela.tenantId,
          modo: tela.modo,
          estacaoId: tela.estacaoId,
          setorId: tela.setorId,
          revogadoEm: tela.revogadoEm,
        })
        .from(tela)
        .where(eq(tela.codigoCurto, tokenOuCodigo))
        .limit(1)
    )[0];

  if (!linha || linha.revogadoEm !== null) {
    return null;
  }
  await database.db.update(tela).set({ ultimoUsoEm: new Date() }).where(eq(tela.id, linha.id));
  return {
    tenantId: linha.tenantId,
    telaId: linha.id,
    modo: linha.modo,
    estacaoId: linha.estacaoId,
    setorId: linha.setorId,
  };
}
