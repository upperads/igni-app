import { createClient } from "@supabase/supabase-js";
import type { AuthIdentityPort, CriarIdentidadeInput } from "@/application/ports/auth-identity";
import { EmailJaCadastradoError } from "@/domain/shared/errors";

/**
 * Adaptador da porta de identidade sobre o Supabase Auth (ADR-006). Usa a chave `service_role`
 * (admin) — só pode ser instanciado no servidor (onboarding), nunca no cliente.
 */
export function createSupabaseAuthIdentity(
  supabaseUrl: string,
  serviceRoleKey: string,
): AuthIdentityPort {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    async criarIdentidade({ email, senha }: CriarIdentidadeInput): Promise<string> {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
      });

      if (error) {
        const e = error as { message?: string; status?: number; code?: string };
        if (e.code === "email_exists" || e.status === 422 || (e.message ?? "").toLowerCase().includes("already")) {
          throw new EmailJaCadastradoError(email);
        }
        throw error;
      }

      const id = data.user?.id;
      if (!id) {
        throw new Error("Supabase Auth não retornou o id da identidade criada.");
      }
      return id;
    },

    async removerIdentidade(authUserId: string): Promise<void> {
      const { error } = await admin.auth.admin.deleteUser(authUserId);
      if (error) {
        throw error;
      }
    },
  };
}
