import { asc, eq } from "drizzle-orm";
import type { AuthIdentityPort } from "@/application/ports/auth-identity";
import { exigeMfa, type Papel } from "@/domain/auth/papel";
import { DadosInvalidosError, EmailJaCadastradoError } from "@/domain/shared/errors";
import type { Database } from "@/infra/db/connection";
import { isUniqueViolation } from "@/infra/db/errors";
import { usuario } from "@/infra/db/schema";
import type { SessaoTenant } from "./abrir-os";

/**
 * Gestão da equipe da oficina (I1 — Fase de Implantação). É o que destrava o piloto: sem isto, só
 * existe o admin do onboarding e "botar na mão dos caras" é impossível. O convite cria a identidade
 * no provedor com uma SENHA PROVISÓRIA (não depende de SMTP) e a devolve para o dono entregar.
 *
 * Tudo escopado ao tenant corrente (`withTenant` aplica a RLS): um tenant nunca vê/edita a equipe
 * de outro. Papéis administrativos (dono/gestor) já exigem 2FA pela `exigeMfa` — marcado no JWT.
 */

export interface MembroView {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  desativadoEm: Date | null;
  /** Não tem identidade ainda (não consegue logar) — raro, mas honesto de mostrar. */
  semAcesso: boolean;
  criadoEm: Date;
}

export interface ConvidarMembroInput {
  nome: string;
  email: string;
  papel: Papel;
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

/** Lista a equipe do tenant (ativos primeiro, por nome). */
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
      })
      .from(usuario)
      .orderBy(asc(usuario.nome));

    return linhas
      .map<MembroView>((l) => ({
        id: l.id,
        nome: l.nome,
        email: l.email,
        papel: l.papel,
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
 * (RLS). Se a persistência falhar, COMPENSA removendo a identidade órfã (saga, igual ao onboarding).
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

  // 1) Identidade com senha provisória. Papel admin (dono/gestor) entra exigindo 2FA.
  const { authUserId, senhaProvisoria } = await deps.auth.criarComSenhaProvisoria({
    email,
    appMetadata: { papel: input.papel, requires_mfa: exigeMfa(input.papel) },
  });

  // 2) Linha na equipe (RLS garante o tenant correto). Falhou? Compensa a identidade.
  try {
    const membroId = await deps.database.withTenant(sessao.tenantId, async (tx) => {
      const [novo] = await tx
        .insert(usuario)
        .values({ tenantId: sessao.tenantId, authUserId, nome, email, papel: input.papel })
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
 * Muda o papel de um membro. Não permite rebaixar a si mesmo (evita o dono se trancar para fora da
 * administração por engano). O `app_metadata` do JWT NÃO é reescrito aqui — o papel que vale é o do
 * banco (resolvido a cada sessão); o `requires_mfa` do convite permanece, o que é seguro (a favor
 * de exigir 2FA, nunca de afrouxar).
 */
export function mudarPapel(
  database: Database,
  sessao: SessaoTenant,
  membroId: string,
  papel: Papel,
): Promise<void> {
  if (membroId === sessao.usuarioId) {
    throw new DadosInvalidosError("Você não pode mudar o seu próprio papel.");
  }
  return database.withTenant(sessao.tenantId, async (tx) => {
    const [alvo] = await tx
      .select({ id: usuario.id })
      .from(usuario)
      .where(eq(usuario.id, membroId))
      .limit(1);
    if (!alvo) {
      throw new DadosInvalidosError("Membro não encontrado.");
    }
    await tx.update(usuario).set({ papel }).where(eq(usuario.id, membroId));
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
