import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function env(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variável de ambiente ${nome} não definida.`);
  }
  return valor;
}

/**
 * Cliente Supabase para Server Components / Server Actions, com a sessão nos cookies (ADR-006).
 * O `signInWithPassword` por aqui estabelece a sessão como efeito colateral.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado de um Server Component (cookies read-only): o middleware renova a sessão.
        }
      },
    },
  });
}
