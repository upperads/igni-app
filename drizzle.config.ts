import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL não definido — veja .env.example");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infra/db/schema/index.ts",
  out: "./src/infra/db/migrations",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
