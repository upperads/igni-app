import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/infra/auth/supabase-server";

/**
 * Confirma um link de e-mail (ex.: recuperação de senha). Verifica o `token_hash` server-side,
 * estabelece a sessão nos cookies e redireciona para `next`. Padrão @supabase/ssr (sem expor
 * token no fragmento da URL).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (tokenHash && tipo) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?erro=link-invalido", origin));
}
