import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Testes de integração compartilham o banco `igni_test` (reset por arquivo). Rodar os
    // arquivos em série evita corrida (um dropa o schema enquanto outro consulta).
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
