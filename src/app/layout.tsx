import type { Metadata } from "next";
import { Archivo, Saira_Condensed, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

// Placa industrial (display): títulos, KPIs, nomes de estação.
const display = Saira_Condensed({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-saira",
});
// Grotesca robusta (corpo): UI.
const body = Archivo({ subsets: ["latin"], variable: "--font-archivo" });
// Instrumento (mono): código de OS, cronômetros, medidas.
const mono = Spline_Sans_Mono({ subsets: ["latin"], variable: "--font-spline-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://igni-app-production.up.railway.app",
  ),
  title: "Igni — Painel da oficina",
  description: "O sistema operacional da sua oficina: triagem em tempo real e status para o cliente.",
};

// Aplica o tema salvo ANTES da pintura (evita flash). Escuro é o default.
const TEMA_SCRIPT = `(function(){try{var t=localStorage.getItem("igni-tema");if(t==="claro")document.documentElement.dataset.tema="claro";}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
