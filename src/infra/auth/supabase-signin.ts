import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthSignInPort, SignInInput, SignInResult } from "@/application/ports/auth-signin";

/**
 * Adaptador da porta de sign-in sobre o Supabase Auth. Recebe um `SupabaseClient` já criado pela
 * rota (via `@supabase/ssr`, que cuida dos cookies de sessão) — então o `signInWithPassword`
 * estabelece a sessão como efeito colateral, e aqui só traduzimos o resultado para a porta.
 * Integração testada na camada web (Wave 3d), com o GoTrue rodando.
 */
export function createSupabaseSignIn(client: SupabaseClient): AuthSignInPort {
  return {
    async entrar({ email, senha }: SignInInput): Promise<SignInResult | null> {
      const { data, error } = await client.auth.signInWithPassword({ email, password: senha });
      if (error) {
        // 400 = credenciais inválidas → conta como tentativa falha. Demais erros sobem.
        if (error.status === 400) {
          return null;
        }
        throw error;
      }
      if (!data.user) {
        return null;
      }

      const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      return { authUserId: data.user.id, aal2: aal?.currentLevel === "aal2" };
    },
  };
}
