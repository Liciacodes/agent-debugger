import { connection } from "next/server";
import { prismaStore } from "@/server/prisma-store";
import { createRunsApi } from "@/server/runs-api";

const api = createRunsApi(prismaStore, () => process.env.RECORDER_TOKEN);

export async function POST(request: Request) {
  return api.postRun(request);
}

export async function GET() {

  await connection();
  return api.listRuns();
}
