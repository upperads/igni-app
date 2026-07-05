import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROTAS_PUBLICAS = ["/login", "/criar-conta"];

// Rotas que sempre passam (sem redirecionar por auth nem por 2FA):
// - recuperação de senha (sessão AAL1 que precisa chegar à tela de nova senha);
// - portal do cliente (público, sem sessão — o TOKEN é a credencial, ADR-012);
// - quiosque de setor (público, sem sessão — o TOKEN/código é a credencial, mesmo padrão do portal);
// - TV do setor (público, sem sessão — mesmo padrão; e o pareamento /tv/entrar, também sem sessão).
const ROTAS_LIVRES = ["/recuperar", "/atualizar-senha", "/auth", "/portal", "/quiosque", "/tv"];

function ehPublica(path: string): boolean {
  return ROTAS_PUBLICAS.some((r) => path === r || path.startsWith(`${r}/`));
}

function redirecionar(request: NextRequest, response: NextResponse, destino: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = destino;
  url.search = "";
  const redir = NextResponse.redirect(url);
  // Preserva os cookies de sessão que o Supabase possa ter renovado.
  for (const cookie of response.cookies.getAll()) {
    redir.cookies.set(cookie);
  }
  return redir;
}

/**
 * Renova a sessão (padrão @supabase/ssr) E protege as rotas:
 * - não autenticado em rota protegida → /login;
 * - autenticado que precisa de 2FA (papel admin via `requires_mfa`, ou fator verificado pendente
 *   de step-up) e ainda não está em AAL2 → /login/2fa;
 * - já resolvido, mas numa tela de auth → /.
 */
export async function atualizarSessaoEProteger(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const eh2fa = path === "/login/2fa";

  // Rotas do fluxo de recuperação passam sem qualquer redirecionamento.
  if (ROTAS_LIVRES.some((r) => path === r || path.startsWith(`${r}/`))) {
    return response;
  }

  if (!user) {
    if (ehPublica(path) || eh2fa) {
      return response;
    }
    return redirecionar(request, response, "/login");
  }

  // Perf: só bate na rede pelo AAL quem PODE precisar de 2FA. Papéis não-admin (sem `requires_mfa`)
  // nunca fazem step-up nem enrollment — pular o round-trip do `getAuthenticatorAssuranceLevel()` corta
  // uma chamada de rede em toda navegação da maioria dos usuários (recepção/produção). Quem exige MFA
  // (admin) ainda paga a checagem, que é onde ela importa.
  const exigeMfa = user.app_metadata?.requires_mfa === true;
  let precisa2fa = false;
  if (exigeMfa) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const emAal2 = aal?.currentLevel === "aal2";
    precisa2fa = !emAal2;
  }

  if (precisa2fa) {
    return eh2fa ? response : redirecionar(request, response, "/login/2fa");
  }

  if (ehPublica(path) || eh2fa) {
    return redirecionar(request, response, "/");
  }

  return response;
}
