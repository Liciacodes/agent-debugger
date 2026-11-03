import { loadEnvConfig } from "@next/env";

const quietLog = { info: () => {}, error: console.error };

// Loads .env.local and the other .env files by the same rules as the Next
// server, for code that runs outside it: the CLI commands and Prisma's config.
// A variable that's already set is never overwritten.
export function loadEnvFiles(): void {
  loadEnvConfig(process.cwd(), true, quietLog);
}
