import { defineConfig } from "prisma/config";
import { loadEnvFiles } from "./src/lib/env";

loadEnvFiles();

// Settings for the Prisma command line (migrate, studio, generate).
// Migrations use the DIRECT connection: Neon's pooler doesn't support
// everything migrations need.
// The live site has no DIRECT_URL: it only runs `prisma generate`, which
// writes code and never connects. Without the address, migrate and studio
// stop with Prisma's own "datasource url is required" error.
const directUrl = process.env.DIRECT_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  ...(directUrl ? { datasource: { url: directUrl } } : {}),
});
