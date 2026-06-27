import { createClient } from "@supabase/supabase-js";
import type {
  AuthIdentityPort,
  CriarIdentidadeInput,
  IdentidadeProvisoria,
} from "@/application/ports/auth-identity";
import { EmailJaCadastradoError } from "@/domain/shared/errors";

/** Alfabeto sem caracteres ambíguos (0/O, 1/I/l) — a senha provisória é ditada por voz/WhatsApp. */
const ALFABETO_SEGURO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Senha provisória forte e legível: "Igni-XXXX-XXXX" (8 chars de entropia segura). */
function gerarSenhaProvisoria(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALFABETO_SEGURO[b % ALFABETO_SEGURO.length]);
  return `Igni-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/** Mapeia o erro de e-mail duplicado do Supabase Auth para o erro de domínio. */
function eEmailDuplicado(error: { message?: string; status?: number; code?: string }): boolean {
  return (
    error.code === "email_exists" ||
    error.status === 422 ||
    (error.message ?? "").toLowerCase().includes("already")
  );
}

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
    async criarIdentidade({ email, senha, appMetadata }: CriarIdentidadeInput): Promise<string> {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        app_metadata: appMetadata,
      });

      if (error) {
        if (eEmailDuplicado(error as { message?: string; status?: number; code?: string })) {
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

    async criarComSenhaProvisoria({ email, appMetadata }): Promise<IdentidadeProvisoria> {
      const senhaProvisoria = gerarSenhaProvisoria();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: senhaProvisoria,
        email_confirm: true,
        app_metadata: appMetadata,
      });

      if (error) {
        if (eEmailDuplicado(error as { message?: string; status?: number; code?: string })) {
          throw new EmailJaCadastradoError(email);
        }
        throw error;
      }

      const authUserId = data.user?.id;
      if (!authUserId) {
        throw new Error("Supabase Auth não retornou o id da identidade criada.");
      }
      return { authUserId, senhaProvisoria };
    },

    async removerIdentidade(authUserId: string): Promise<void> {
      const { error } = await admin.auth.admin.deleteUser(authUserId);
      if (error) {
        throw error;
      }
    },
  };
}
