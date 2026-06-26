import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Seu serviço — Igni",
  robots: { index: false, follow: false },
};

/** Moldura do portal do cliente: tema CLARO (osso), tela cheia, sem a navegação do board escuro. */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-dvh bg-osso-50 text-tinta-900"
      style={{ colorScheme: "light" }}
    >
      {children}
    </div>
  );
}
