import { defineConfig, env } from "prisma/config";
import { loadEnvFiles } from "./src/lib/env";

loadEnvFiles();

// Settings for the Prisma command line (migrate, studio, generate).
// Migrations use the DIRECT connection: Neon's pooler doesn't support
// everything migrations need.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DIRECT_URL") },
});
