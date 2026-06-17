import type { AppDatabase } from "@/infra/db/connection";
import { isUniqueViolation } from "@/infra/db/errors";
import { estacao, tenant, usuario } from "@/infra/db/schema";
import { DadosInvalidosError, EmailJaCadastradoError } from "@/domain/shared/errors";
import { estacoesDoRamo, type Ramo } from "@/domain/templates/ramo";

export interface CriarOficinaInput {
  nomeOficina: string;
  ramo: Ramo;
  admin: { nome: string; email: string };
}

export interface CriarOficinaResult {
  tenantId: string;
  adminId: string;
  estacoesCriadas: number;
}

/**
 * US-01 — onboarding da oficina. Cria o tenant, o usuário admin (papel `dono`) e pré-carrega
 * as estações do template do ramo, tudo numa transação atômica.
 *
 * Roda na conexão PRIVILEGIADA (`db`) de propósito: ainda não existe um tenant corrente, então
 * a RLS não se aplica (ADR-005). A partir daí, todo acesso normal passa por `withTenant`.
 *
 * `db` é injetado para testabilidade (a suíte passa o banco de testes).
 */
export async function criarOficina(
  db: AppDatabase,
  input: CriarOficinaInput,
): Promise<CriarOficinaResult> {
  const nomeOficina = input.nomeOficina.trim();
  const adminNome = input.admin.nome.trim();
  const email = input.admin.email.trim().toLowerCase();

  if (!nomeOficina) {
    throw new DadosInvalidosError("Nome da oficina é obrigatório.");
  }
  if (!adminNome) {
    throw new DadosInvalidosError("Nome do administrador é obrigatório.");
  }
  if (!email.includes("@")) {
    throw new DadosInvalidosError("E-mail do administrador inválido.");
  }

  const estacoes = estacoesDoRamo(input.ramo);

  try {
    return await db.transaction(async (tx) => {
      const [oficina] = await tx
        .insert(tenant)
        .values({ nome: nomeOficina, templateRamo: input.ramo })
        .returning({ id: tenant.id });

      const [admin] = await tx
        .insert(usuario)
        .values({ tenantId: oficina!.id, nome: adminNome, email, papel: "dono" })
        .returning({ id: usuario.id });

      if (estacoes.length > 0) {
        await tx.insert(estacao).values(
          estacoes.map((e) => ({ tenantId: oficina!.id, nome: e.nome, ordem: e.ordem })),
        );
      }

      return {
        tenantId: oficina!.id,
        adminId: admin!.id,
        estacoesCriadas: estacoes.length,
      };
    });
  } catch (err) {
    if (isUniqueViolation(err, "usuario_email_unico")) {
      throw new EmailJaCadastradoError(email);
    }
    throw err;
  }
}
