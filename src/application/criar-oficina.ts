import type { AuthIdentityPort } from "@/application/ports/auth-identity";
import { CARGO_DONO, CARGOS_SEMENTE } from "@/domain/auth/cargo";
import { DadosInvalidosError, EmailJaCadastradoError } from "@/domain/shared/errors";
import { estacoesDoRamo, type Ramo } from "@/domain/templates/ramo";
import type { AppDatabase } from "@/infra/db/connection";
import { isUniqueViolation } from "@/infra/db/errors";
import { cargo, estacao, tenant, usuario } from "@/infra/db/schema";

/** Tamanho mínimo de senha aceito pelo onboarding (alinhado ao Supabase Auth local). */
export const SENHA_MIN_LENGTH = 8;

export interface CriarOficinaInput {
  nomeOficina: string;
  ramo: Ramo;
  admin: { nome: string; email: string; senha: string };
}

export interface CriarOficinaDeps {
  db: AppDatabase;
  auth: AuthIdentityPort;
}

export interface CriarOficinaResult {
  tenantId: string;
  adminId: string;
  authUserId: string;
  estacoesCriadas: number;
}

/**
 * US-01 — onboarding da oficina. Cria a identidade no provedor de auth (ADR-006), depois o tenant,
 * o usuário admin (papel `dono`, ligado à identidade) e as estações do template — tudo atômico no
 * banco. Se a persistência falhar, **compensa** removendo a identidade órfã (saga).
 *
 * Roda na conexão PRIVILEGIADA (`db`): ainda não há tenant corrente, então a RLS não se aplica
 * (a partir daí o acesso normal passa por `withTenant`). `db` e `auth` são injetados (testáveis).
 */
export async function criarOficina(
  deps: CriarOficinaDeps,
  input: CriarOficinaInput,
): Promise<CriarOficinaResult> {
  const nomeOficina = input.nomeOficina.trim();
  const adminNome = input.admin.nome.trim();
  const email = input.admin.email.trim().toLowerCase();
  const senha = input.admin.senha;

  if (!nomeOficina) {
    throw new DadosInvalidosError("Nome da oficina é obrigatório.");
  }
  if (!adminNome) {
    throw new DadosInvalidosError("Nome do administrador é obrigatório.");
  }
  if (!email.includes("@")) {
    throw new DadosInvalidosError("E-mail do administrador inválido.");
  }
  if (senha.length < SENHA_MIN_LENGTH) {
    throw new DadosInvalidosError(`Senha deve ter ao menos ${SENHA_MIN_LENGTH} caracteres.`);
  }

  const estacoes = estacoesDoRamo(input.ramo);

  // 1) Cria a identidade (lança EmailJaCadastradoError se o e-mail já existe no provedor). O admin
  //    nasce `dono` (papel administrativo): marca `requires_mfa` no app_metadata (entra no JWT)
  //    para o middleware exigir 2FA sem consultar o banco no edge.
  const authUserId = await deps.auth.criarIdentidade({
    email,
    senha,
    appMetadata: { papel: "dono", requires_mfa: true },
  });

  // 2) Persiste o tenant + admin + estações + os 7 cargos-semente (P-1). Se falhar, compensa a
  //    identidade (passo 3). Sem os cargos-semente aqui, o tenant nasceria sem RBAC funcional —
  //    o admin logaria sem NENHUMA permissão (o cargo é a fonte de verdade, não mais o `papel`).
  try {
    return await deps.db.transaction(async (tx) => {
      const [oficina] = await tx
        .insert(tenant)
        .values({ nome: nomeOficina, templateRamo: input.ramo })
        .returning({ id: tenant.id });

      const cargosCriados = await tx
        .insert(cargo)
        .values(
          CARGOS_SEMENTE.map((c) => ({
            tenantId: oficina!.id,
            nome: c.nome,
            sistema: c.sistema,
            chao: c.chao,
            exige2fa: c.exige2fa,
            permissoes: [...c.permissoes],
          })),
        )
        .returning({ id: cargo.id, nome: cargo.nome });
      const cargoDono = cargosCriados.find((c) => c.nome === CARGO_DONO);
      if (!cargoDono) {
        throw new Error("Falha ao semear o cargo Dono do tenant novo.");
      }

      const [admin] = await tx
        .insert(usuario)
        .values({
          tenantId: oficina!.id,
          authUserId,
          nome: adminNome,
          email,
          papel: "dono",
          cargoId: cargoDono.id,
        })
        .returning({ id: usuario.id });

      if (estacoes.length > 0) {
        await tx.insert(estacao).values(
          estacoes.map((e) => ({ tenantId: oficina!.id, nome: e.nome, ordem: e.ordem })),
        );
      }

      return {
        tenantId: oficina!.id,
        adminId: admin!.id,
        authUserId,
        estacoesCriadas: estacoes.length,
      };
    });
  } catch (err) {
    // 3) Compensação best-effort: não deixa identidade órfã se a persistência falhou.
    await deps.auth.removerIdentidade(authUserId).catch(() => undefined);
    if (isUniqueViolation(err, "usuario_email_unico")) {
      throw new EmailJaCadastradoError(email);
    }
    throw err;
  }
}
