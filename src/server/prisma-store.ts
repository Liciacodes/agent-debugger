import "server-only";
import { Prisma } from "../generated/prisma/client";
import type { Run } from "../recorder/types";
import { getPrisma } from "./db";
import type { RunStore } from "./runs-api";


const TRANSACTION_MAX_WAIT_MS = 10_000;


const withSteps = { steps: { orderBy: { position: "asc" } } } satisfies Prisma.RunInclude;

type RunRow = Prisma.RunGetPayload<{ include: typeof withSteps }>;


function toRun(row: RunRow): Run {
  return {
    id: row.id,
    question: row.question,
    model: row.model,
    promptVersion: row.promptVersion,
    startedAt: row.startedAt.toISOString(),
    status: row.status,
    answer: row.answer,
    error: row.error,
    steps: row.steps.map((step) => ({
      id: step.id,
      parentId: step.parentId,
      type: step.type,
      name: step.name,
      round: step.round,
      startMs: step.startMs,
      durationMs: step.durationMs,
      tokens: step.tokens,
      input: step.input,
      output: step.output,
      reasoning: step.reasoning,
      ok: step.ok,
      error: step.error,
    })),
  };
}

export const prismaStore: RunStore = {
  async addRun(run) {
    const prisma = getPrisma();
    const { steps, ...fields } = run;

    try {
      
      await prisma.$transaction(
        [
          prisma.run.create({ data: { ...fields, startedAt: new Date(run.startedAt) } }),
          prisma.step.createMany({
            data: steps.map((step, position) => ({ ...step, runId: run.id, position })),
          }),
        ],
        { maxWait: TRANSACTION_MAX_WAIT_MS },
      );
      return true;
    } catch (error) {
     
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return false;
      }
      throw error;
    }
  },

  async listRuns(limit) {
    const rows = await getPrisma().run.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
      include: withSteps,
    });
    return rows.map(toRun);
  },

  async getRun(id) {
    const row = await getPrisma().run.findUnique({ where: { id }, include: withSteps });
    return row ? toRun(row) : null;
  },
};
