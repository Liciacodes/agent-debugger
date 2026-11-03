import { connection } from "next/server";
import { prismaStore } from "@/server/prisma-store";
import { createRunsApi } from "@/server/runs-api";

const api = createRunsApi(prismaStore, () => process.env.RECORDER_TOKEN);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Built for each request, never ahead of time during `next build`.
  await connection();
  const { id } = await params;
  return api.getRun(id);
}
