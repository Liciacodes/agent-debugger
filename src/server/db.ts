import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// Kept on globalThis so `npm run dev` reuses one client across reloads,
// instead of opening new database connections every time a file is saved.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// The shared client. It talks to Neon through the POOLED url, and is only
// created when first used, so `next build` doesn't need the database.
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is missing. Add it to .env.local.");
    }

    globalForPrisma.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  return globalForPrisma.prisma;
}
