import { createHash, createHmac, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { type EstadoOS, validarTransicao } from "@/domain/os/estado";
import { normalizarPin } from "@/domain/os/pin";
import { ALFABETO_CODIGO, gerarCodigoCurto } from "@/domain/os/quiosque";
import { DadosInvalidosError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { estacao, evento, os, quiosqueSetor, usuario } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/**
 * Hash do TOKEN do quiosque: sha256 puro. Correto porque o token tem ALTA entropia (256 bits
 * aleatórios) — força bruta é inviável, então salt/HMAC não adicionam segurança (padrão do portal).
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Hash do PIN: HMAC-SHA256 com segredo do servidor. O PIN tem BAIXA entropia (4 dígitos = 10 mil),
 * então sha256 puro seria pré-computável (rainbow table) num eventual dump do banco. O HMAC com um
 * segredo que NÃO está no banco mata isso — sem o segredo, o `pin_hash` não é reversível. O PIN é
 * carimbo de autoria (não destranca nada), mas isto é defesa em profundidade + LGPD (PIN liga à
 * pessoa). A busca PIN→usuário segue por igualdade de hash (o segredo é o mesmo p/ gravar e resolver).
 */
export function hashPin(pin: string): string {
  const segredo = process.env.PIN_HMAC_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "igni-pin-dev";
  return createHmac("sha256", segredo).update(pin).digest("hex");
}

/** Sufixo aleatório do código curto (4 chars do alfabeto sem ambíguos), via crypto. */
function sufixoCodigo(): string {
  const bytes = randomBytes(4);
  return Array.from(bytes, (b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join("");
}

export interface QuiosqueView {
  id: string;
  estacaoId: string;
  estacaoNome: string;
  codigoCurto: string;
  ativo: boolean;
  ultimoUsoEm: Date | null;
}

/**
 * Admin gera o quiosque de um setor: cria o token forte (devolve o CRU uma vez p/ o QR), guarda só
 * o hash + o código curto único. Escopado ao tenant (RLS). Regenera o código se colidir (raro).
 */
export async function gerarQuiosque(
  database: Database,
  sessao: SessaoTenant,
  estacaoId: string,
): Promise<{ token: string; codigoCurto: string }> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [est] = await tx
      .select({ nome: estacao.nome })
      .from(estacao)
      .where(eq(estacao.id, estacaoId))
      .limit(1);
    if (!est) {
      throw new DadosInvalidosError("Estação não encontrada.");
    }
    const token = randomBytes(32).toString("base64url");
    // Tenta até um código curto único (UNIQUE global; colisão é rara).
    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      const codigoCurto = gerarCodigoCurto(est.nome, sufixoCodigo());
      try {
        await tx.insert(quiosqueSetor).values({
          tenantId: sessao.tenantId,
          estacaoId,
          tokenHash: hashToken(token),
          codigoCurto,
          criadoPor: sessao.usuarioId,
        });
        return { token, codigoCurto };
      } catch (err) {
        // colisão de codigo_curto UNIQUE → tenta de novo; outro erro → propaga
        if (tentativa === 4) {
          throw err;
        }
      }
    }
    throw new DadosInvalidosError("Não foi possível gerar o quiosque. Tente de novo.");
  });
}

/** Revoga (desliga) um quiosque: mata o token na hora. RLS garante que só o próprio tenant revoga. */
export function revogarQuiosque(
  database: Database,
  sessao: SessaoTenant,
  quiosqueId: string,
): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx
      .update(quiosqueSetor)
      .set({ revogadoEm: new Date() })
      .where(eq(quiosqueSetor.id, quiosqueId));
  });
}

/** Lista os quiosques do tenant (com nome do setor e se está ativo) — pra tela de Estações. */
export function listarQuiosques(database: Database, sessao: SessaoTenant): Promise<QuiosqueView[]> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const linhas = await tx
      .select({
        id: quiosqueSetor.id,
        estacaoId: quiosqueSetor.estacaoId,
        estacaoNome: estacao.nome,
        codigoCurto: quiosqueSetor.codigoCurto,
        revogadoEm: quiosqueSetor.revogadoEm,
        ultimoUsoEm: quiosqueSetor.ultimoUsoEm,
      })
      .from(quiosqueSetor)
      .innerJoin(estacao, eq(estacao.id, quiosqueSetor.estacaoId));
    return linhas.map((l) => ({
      id: l.id,
      estacaoId: l.estacaoId,
      estacaoNome: l.estacaoNome,
      codigoCurto: l.codigoCurto,
      ativo: l.revogadoEm === null,
      ultimoUsoEm: l.ultimoUsoEm,
    }));
  });
}

/** Admin define/reseta o PIN de um membro de PRODUÇÃO. Guarda só o hash. */
export async function definirPin(
  database: Database,
  sessao: SessaoTenant,
  usuarioId: string,
  pinBruto: string,
): Promise<void> {
  const pin = normalizarPin(pinBruto);
  if (!pin) {
    throw new DadosInvalidosError("O PIN deve ter 4 dígitos.");
  }
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [alvo] = await tx
      .select({ papel: usuario.papel })
      .from(usuario)
      .where(eq(usuario.id, usuarioId))
      .limit(1);
    if (!alvo) {
      throw new DadosInvalidosError("Membro não encontrado.");
    }
    if (alvo.papel !== "producao") {
      throw new DadosInvalidosError("O PIN é só para a equipe de produção (chão).");
    }
    await tx.update(usuario).set({ pinHash: hashPin(pin) }).where(eq(usuario.id, usuarioId));
  });
}

/** Remove o PIN de um membro. */
export function limparPin(
  database: Database,
  sessao: SessaoTenant,
  usuarioId: string,
): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx.update(usuario).set({ pinHash: null }).where(eq(usuario.id, usuarioId));
  });
}

export interface QuiosqueResolvido {
  tenantId: string;
  estacaoId: string;
  quiosqueId: string;
}

/**
 * Etapa 1 (PRIVILEGIADA, mínima): resolve o quiosque por TOKEN (`token_hash`) OU por código curto.
 * O tenant/estação vêm do REGISTRO, nunca do input. Null se não existe ou está revogado. O token
 * usa `hashToken` (sha256, alta entropia); o código curto é comparado em claro (é público por
 * natureza — atalho de backup, não credencial — e protegido por rate-limit na rota, Task 7).
 */
export async function resolverQuiosque(
  database: Database,
  tokenOuCodigo: string,
  _agora: Date,
): Promise<QuiosqueResolvido | null> {
  if (!tokenOuCodigo || tokenOuCodigo.length < 4) {
    return null;
  }
  const [porToken] = await database.db
    .select({
      id: quiosqueSetor.id,
      tenantId: quiosqueSetor.tenantId,
      estacaoId: quiosqueSetor.estacaoId,
      revogadoEm: quiosqueSetor.revogadoEm,
    })
    .from(quiosqueSetor)
    .where(eq(quiosqueSetor.tokenHash, hashToken(tokenOuCodigo)))
    .limit(1);
  // tenta como token; se não achou, tenta como código curto (entrada de backup)
  const linha =
    porToken ??
    (
      await database.db
        .select({
          id: quiosqueSetor.id,
          tenantId: quiosqueSetor.tenantId,
          estacaoId: quiosqueSetor.estacaoId,
          revogadoEm: quiosqueSetor.revogadoEm,
        })
        .from(quiosqueSetor)
        .where(eq(quiosqueSetor.codigoCurto, tokenOuCodigo))
        .limit(1)
    )[0];
  if (!linha || linha.revogadoEm !== null) {
    return null;
  }
  return { tenantId: linha.tenantId, estacaoId: linha.estacaoId, quiosqueId: linha.id };
}

export interface ResultadoQuiosque {
  ok: boolean;
  motivo?: string;
}

/**
 * Bump pelo quiosque: resolve o quiosque (etapa 1) → dentro do tenant, confere que a OS é do SETOR
 * do quiosque → valida a transição → resolve o PIN em um usuário `producao` do tenant (carimbo) →
 * grava a transição com `porUsuarioId` = usuário do PIN e `origem='chao'`. PIN errado NÃO destranca.
 * O gate de orçamento é dado como cumprido (o bump do chão não deve barrar por falta de orçamento —
 * isso é responsabilidade do escritório, resolvida antes da OS chegar ao setor físico).
 */
export async function bumpPorQuiosque(
  database: Database,
  token: string,
  osId: string,
  para: EstadoOS,
  pinBruto: string,
  agora: Date,
): Promise<ResultadoQuiosque> {
  const q = await resolverQuiosque(database, token, agora);
  if (!q) {
    return { ok: false, motivo: "Quiosque desligado. Peça um novo ao escritório." };
  }
  const pin = normalizarPin(pinBruto);
  if (!pin) {
    return { ok: false, motivo: "PIN inválido (4 dígitos)." };
  }
  return database.withTenant(q.tenantId, async (tx) => {
    // 1) PIN → usuário produção do tenant (carimbo). Não achou = PIN não confere (não destranca).
    const [autor] = await tx
      .select({ id: usuario.id })
      .from(usuario)
      .where(and(eq(usuario.pinHash, hashPin(pin)), eq(usuario.papel, "producao")))
      .limit(1);
    if (!autor) {
      return { ok: false, motivo: "PIN não confere. Tente de novo." };
    }
    // 2) A OS tem que ser do SETOR do quiosque (escopo mínimo).
    const [ordem] = await tx
      .select({ estado: os.estado, estacaoId: os.estacaoId, cqAprovado: os.cqAprovado })
      .from(os)
      .where(eq(os.id, osId))
      .limit(1);
    if (!ordem || ordem.estacaoId !== q.estacaoId) {
      return { ok: false, motivo: "Esta OS não é deste setor." };
    }
    // 3) Valida a transição (gates lidos do dado, como o /chao). cqAprovado já lido acima.
    const contexto = { orcamentoAprovado: true, cqAprovado: ordem.cqAprovado };
    const veredito = validarTransicao(ordem.estado, para, contexto);
    if (!veredito.ok) {
      return { ok: false, motivo: veredito.motivo };
    }
    // 4) Aplica + carimba (porUsuarioId = autor do PIN, origem=chao).
    await tx
      .update(os)
      .set({
        estado: para,
        entrouNoEstadoEm: agora,
        ...(para === "controle_qualidade" ? { cqAprovado: false } : {}),
      })
      .where(eq(os.id, osId));
    await tx.insert(evento).values({
      tenantId: q.tenantId,
      osId,
      deEstado: ordem.estado,
      paraEstado: para,
      porUsuarioId: autor.id,
      origem: "chao",
    });
    // marca uso do quiosque
    await tx
      .update(quiosqueSetor)
      .set({ ultimoUsoEm: agora })
      .where(eq(quiosqueSetor.id, q.quiosqueId));
    return { ok: true };
  });
}
