import type { NextConfig } from "next";

/**
 * Headers de segurança (varredura AppSec). Fase 1, sem CSP de script (que exigiria auditar cada
 * inline/eval e poderia quebrar o app em produção) — só o conjunto de baixo risco + o anti-clickjacking.
 * O portal público ganha `frame-ancestors 'none'` porque MUTA estado (aprovar/recusar orçamento):
 * sem isso, dá para embuti-lo num iframe e enganar o cliente por clickjacking.
 */
const SEGURANCA_BASE = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SEGURANCA_BASE,
      },
      {
        // O portal do cliente nunca deve ser embutido em iframe de terceiro.
        source: "/portal/:path*",
        headers: [
          ...SEGURANCA_BASE,
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
