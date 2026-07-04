import { asc, eq, sql } from "drizzle-orm";
import type { AuthIdentityPort } from "@/application/ports/auth-identity";
import { ehCargoDono, exigeMfa } from "@/domain/auth/cargo";
import type { Papel } from "@/domain/auth/papel";
import { DadosInvalidosError, EmailJaCadastradoError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { isUniqueViolation } from "@/infra/db/errors";
import { cargo, usuario } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/**
 * Gestão da equipe da oficina (I1 — Fase de Implantação). É o que destrava o piloto: sem isto, só
 * existe o admin do onboarding e "botar na mão dos caras" é impossível. O convite cria a identidade
 * no provedor com uma SENHA PROVISÓRIA (não depende de SMTP) e a devolve para o dono entregar.
 *
 * Tudo escopado ao tenant corrente (`withTenant` aplica a RLS): um tenant nunca vê/edita a equipe
 * de outro. Cada membro agora é ligado a um CARGO (P-1) — fonte de verdade do RBAC e do 2FA
 * (`exigeMfa` do domínio de cargo). O `papel` legado continua gravado (compat/relatórios antigos),
 * mas NÃO manda mais em autorização.
 */

export interface MembroView {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  /** Cargo atribuído (P-1). Nulo só é transitório — todo membro deveria ter cargo. */
  cargoId: string | null;
  cargoNome: string;
  ativo: boolean;
  desativadoEm: Date | null;
  /** Não tem identidade ainda (não consegue logar) — raro, mas honesto de mostrar. */
  semAcesso: boolean;
  criadoEm: Date;
}

export interface ConvidarMembroInput {
  nome: string;
  email: string;
  cargoId: string;
  /** Se o chamador pode nomear outro Dono (piso de segurança contra auto-escalonamento — P-1). */
  podeGerirCargos: boolean;
}

export interface ConvidarMembroResult {
  membroId: string;
  /** Senha provisória a entregar ao membro (WhatsApp/voz). Não é persistida. */
  senhaProvisoria: string;
}

export interface EquipeDeps {
  database: Database;
  auth: AuthIdentityPort;
}

/**
 * Deriva o `papel` legado (enum fixo do banco) a partir do NOME do cargo. É só compatibilidade —
 * o RBAC não lê mais `papel`. Cargos-semente mapeiam 1:1; cargos customizados caem no piso seguro
 * (`producao`, o mais restrito).
 */
function papelLegadoDoCargo(nomeCargo: string): Papel {
  if (ehCargoDono(nomeCargo)) {
    return "dono";
  }
  if (nomeCargo === "Gestor") {
    return "gestor";
  }
  if (nomeCargo === "Recepção") {
    return "recepcao";
  }
  return "producao";
}

/** Lista a equipe do tenant (ativos primeiro, por nome), com o cargo atribuído. */
export function listarEquipe(database: Database, sessao: SessaoTenant): Promise<MembroView[]> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    const linhas = await tx
      .select({
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
        authUserId: usuario.authUserId,
        desativadoEm: usuario.desativadoEm,
        criadoEm: usuario.createdAt,
        cargoId: usuario.cargoId,
        cargoNome: cargo.nome,
      })
      .from(usuario)
      .leftJoin(cargo, eq(cargo.id, usuario.cargoId))
      .orderBy(asc(usuario.nome));

    return linhas
      .map<MembroView>((l) => ({
        id: l.id,
        nome: l.nome,
        email: l.email,
        papel: l.papel,
        cargoId: l.cargoId,
        cargoNome: l.cargoNome ?? "",
        ativo: l.desativadoEm === null,
        desativadoEm: l.desativadoEm,
        semAcesso: l.authUserId === null,
        criadoEm: l.criadoEm,
      }))
      .sort((a, b) => Number(b.ativo) - Number(a.ativo));
  });
}

/**
 * Convida um membro: cria a identidade com senha provisória (passo externo) e a linha `usuario`
 * (RLS), ligada ao CARGO escolhido. Se a persistência falhar, COMPENSA removendo a identidade
 * órfã (saga, igual ao onboarding). O `requires_mfa` do JWT vem do cargo (piso de 2FA — P-1).
 */
export async function convidarMembro(
  deps: EquipeDeps,
  sessao: SessaoTenant,
  input: ConvidarMembroInput,
): Promise<ConvidarMembroResult> {
  const nome = input.nome.trim();
  const email = input.email.trim().toLowerCase();

  if (!nome) {
    throw new DadosInvalidosError("Nome do membro é obrigatório.");
  }
  if (!email.includes("@")) {
    throw new DadosInvalidosError("E-mail do membro inválido.");
  }

  // 0) Resolve o cargo alvo DENTRO do tenant (garante que o cargoId pertence a este tenant).
  const cargoDoAlvo = await deps.database.withTenant(sessao.tenantId, async (tx) => {
    const [c] = await tx
      .select({ id: cargo.id, nome: cargo.nome, permissoes: cargo.permissoes, exige2fa: cargo.exige2fa })
      .from(cargo)
      .where(eq(cargo.id, input.cargoId))
      .limit(1);
    return c ?? null;
  });
  if (!cargoDoAlvo) {
    throw new DadosInvalidosError("Cargo não encontrado.");
  }
  // Piso de segurança: só quem já pode gerir cargos (Dono) pode nomear outro Dono. Barrado no
  // SERVIDOR — não depender só do filtro da UI evita auto-escalonamento (ex.: Gestor chamando a
  // action direto para se promover ou promover um aliado a Dono).
  if (ehCargoDono(cargoDoAlvo.nome) && !input.podeGerirCargos) {
    throw new DadosInvalidosError("Só o Dono pode nomear outro Dono.");
  }

  const papelLegado = papelLegadoDoCargo(cargoDoAlvo.nome);
  const requiresMfa = exigeMfa({ chao: false, exige2fa: cargoDoAlvo.exige2fa, permissoes: cargoDoAlvo.permissoes });

  // 1) Identidade com senha provisória. O 2FA exigido vem do cargo (piso, nunca teto).
  const { authUserId, senhaProvisoria } = await deps.auth.criarComSenhaProvisoria({
    email,
    appMetadata: { papel: papelLegado, requires_mfa: requiresMfa },
  });

  // 2) Linha na equipe (RLS garante o tenant correto). Falhou? Compensa a identidade.
  try {
    const membroId = await deps.database.withTenant(sessao.tenantId, async (tx) => {
      const [novo] = await tx
        .insert(usuario)
        .values({
          tenantId: sessao.tenantId,
          authUserId,
          nome,
          email,
          papel: papelLegado,
          cargoId: cargoDoAlvo.id,
        })
        .returning({ id: usuario.id });
      return novo!.id;
    });
    return { membroId, senhaProvisoria };
  } catch (err) {
    await deps.auth.removerIdentidade(authUserId).catch(() => undefined);
    if (isUniqueViolation(err, "usuario_email_unico")) {
      throw new EmailJaCadastradoError(email);
    }
    throw err;
  }
}

/**
 * Muda o CARGO de um membro (P-1). Não permite mexer em si mesmo (evita o dono se trancar para
 * fora da administração por engano). Só quem já pode gerir cargos (Dono) pode PROMOVER alguém a
 * Dono — piso de segurança contra auto-escalonamento, barrado no SERVIDOR (não só na UI). Piso 1
 * (último Dono): se o alvo é o único Dono ativo e o novo cargo NÃO é Dono, barra — a oficina
 * sempre precisa de ao menos um Dono. A CONTAGEM e o UPDATE rodam na MESMA transação (uma única
 * `withTenant`) para não abrir uma janela TOCTOU entre duas chamadas concorrentes de `mudarCargo`
 * que, separadas, poderiam zerar os Donos ao mesmo tempo. Atualiza também o `papel` legado
 * (derivado do nome do novo cargo), mas o RBAC não lê mais esse campo.
 */
export async function mudarCargo(
  database: Database,
  sessao: SessaoTenant,
  membroId: string,
  cargoId: string,
  podeGerirCargos: boolean,
): Promise<void> {
  if (membroId === sessao.usuarioId) {
    throw new DadosInvalidosError("Você não pode mudar o seu próprio cargo.");
  }

  return database.withTenant(sessao.tenantId, async (tx) => {
    const [alvo] = await tx
      .select({ id: usuario.id, cargoNomeAtual: cargo.nome })
      .from(usuario)
      .leftJoin(cargo, eq(cargo.id, usuario.cargoId))
      .where(eq(usuario.id, membroId))
      .limit(1);
    if (!alvo) {
      throw new DadosInvalidosError("Membro não encontrado.");
    }

    const [novoCargo] = await tx
      .select({ id: cargo.id, nome: cargo.nome })
      .from(cargo)
      .where(eq(cargo.id, cargoId))
      .limit(1);
    if (!novoCargo) {
      throw new DadosInvalidosError("Cargo não encontrado.");
    }

    const eraDono = alvo.cargoNomeAtual !== null && ehCargoDono(alvo.cargoNomeAtual);
    const continuaDono = ehCargoDono(novoCargo.nome);

    // Piso de segurança: só quem pode gerir cargos promove alguém a Dono.
    if (!eraDono && continuaDono && !podeGerirCargos) {
      throw new DadosInvalidosError("Só o Dono pode nomear outro Dono.");
    }

    // Piso 1: não rebaixa o último Dono ativo. Contagem NA MESMA transação do update (sem TOCTOU).
    if (eraDono && !continuaDono) {
      const [{ n: donos }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(usuario)
        .innerJoin(cargo, eq(cargo.id, usuario.cargoId))
        .where(sql`${cargo.nome} = 'Dono' AND ${usuario.desativadoEm} IS NULL`);
      if (donos <= 1) {
        throw new DadosInvalidosError("A oficina precisa de ao menos um Dono.");
      }
    }

    await tx
      .update(usuario)
      .set({ cargoId: novoCargo.id, papel: papelLegadoDoCargo(novoCargo.nome) })
      .where(eq(usuario.id, membroId));
  });
}

/**
 * Desativa um membro (o cara saiu da firma): marca `desativadoEm`, e a sessão deixa de resolver o
 * perfil dele (`resolverPerfilPorAuthUserId` filtra inativos) — perde o acesso sem apagar a história.
 * Não pode se desativar (evita o dono se trancar para fora).
 */
export function desativarMembro(
  database: Database,
  sessao: SessaoTenant,
  membroId: string,
): Promise<void> {
  if (membroId === sessao.usuarioId) {
    throw new DadosInvalidosError("Você não pode desativar a si mesmo.");
  }
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx
      .update(usuario)
      .set({ desativadoEm: new Date() })
      .where(eq(usuario.id, membroId));
  });
}

/** Reativa um membro desativado (voltou para a firma): limpa `desativadoEm`. */
export function reativarMembro(
  database: Database,
  sessao: SessaoTenant,
  membroId: string,
): Promise<void> {
  return database.withTenant(sessao.tenantId, async (tx) => {
    await tx.update(usuario).set({ desativadoEm: null }).where(eq(usuario.id, membroId));
  });
}
