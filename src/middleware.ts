import type { NextRequest } from "next/server";
import { atualizarSessaoEProteger } from "@/infra/auth/supabase-middleware";

export function middleware(request: NextRequest) {
  return atualizarSessaoEProteger(request);
}

export const config = {
  matcher: [
    // Tudo, menos estáticos do Next e arquivos de imagem.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
