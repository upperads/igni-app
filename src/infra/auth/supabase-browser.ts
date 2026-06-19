import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para componentes de cliente (browser), lendo a sessão dos cookies. Usado no
 * fluxo de 2FA (enroll/challenge/verify do TOTP), que é interativo.
 */
export function createSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Configuração do Supabase ausente (NEXT_PUBLIC_*).");
  }
  return createBrowserClient(url, anonKey);
}
