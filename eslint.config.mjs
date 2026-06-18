import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Guarda de fronteira (review US-01): a camada web (src/app) não acessa o banco PRIVILEGIADO
  // direto (ele faz bypass de RLS). Rotas devem chamar um caso de uso (application) ou o
  // `withTenant`, que aplica a RLS por tenant.
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/infra/db/client",
              importNames: ["db", "database"],
              message:
                "A camada web não acessa o banco privilegiado (bypass de RLS). Use um caso de uso (application) ou withTenant.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
