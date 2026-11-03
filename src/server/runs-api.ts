import { RUN_ID_PATTERN } from "../recorder/run-id";
import { computeTotals } from "../recorder/totals";
import type { Run } from "../recorder/types";
import { checkRecorderToken, RECORDER_TOKEN_HEADER, type TokenCheck } from "./recorder-token";
import { describeProblems, runSchema } from "./run-schema";

const MAX_BODY_BYTES = 1_000_000;
export const RUN_LIST_LIMIT = 100;

// Where runs are kept. The real one uses Postgres (prisma-store.ts); the tests
// use one that keeps runs in memory.
export interface RunStore {
  // Saves a run with its steps, all or nothing. Returns false, and changes
  // nothing, when a run with this id is already stored.
  addRun(run: Run): Promise<boolean>;
  // Newest first, each with its steps.
  listRuns(limit: number): Promise<Run[]>;
  // Steps in order, or null when there's no such run.
  getRun(id: string): Promise<Run | null>;
}

export interface RunSummary {
  id: string;
  question: string;
  status: Run["status"];
  startedAt: string;
  stepCount: number;
  durationMs: number;
}

const TOKEN_PROBLEMS: Record<Exclude<TokenCheck, "ok">, [number, string]> = {
  missing: [401, `Missing the ${RECORDER_TOKEN_HEADER} header.`],
  wrong: [401, "Wrong recorder token."],
  not_configured: [503, "Recording is turned off: RECORDER_TOKEN isn't set on the server."],
};

function errorResponse(status: number, error: string, problems?: string[]): Response {
  return Response.json(problems ? { error, problems } : { error }, { status });
}

// A database error can include details about the query, so only its message
// goes to the server log, and the client gets a plain sentence.
async function safely(what: string, action: () => Promise<Response>): Promise<Response> {
  try {
    return await action();
  } catch (error) {
    console.error(`${what} failed:`, error instanceof Error ? error.message : String(error));
    return errorResponse(500, `The server couldn't ${what}.`);
  }
}

function toSummary(run: Run): RunSummary {
  return {
    id: run.id,
    question: run.question,
    status: run.status,
    startedAt: run.startedAt,
    stepCount: run.steps.length,
    durationMs: computeTotals(run).durationMs,
  };
}

export function createRunsApi(store: RunStore, getToken: () => string | undefined) {
  async function postRun(request: Request): Promise<Response> {
    // The token is checked before the body is read, so strangers can't make
    // the server read anything.
    const token = checkRecorderToken(request.headers.get(RECORDER_TOKEN_HEADER), getToken());

    if (token !== "ok") {
      const [status, message] = TOKEN_PROBLEMS[token];
      return errorResponse(status, message);
    }

    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
      return errorResponse(413, "That run is too big.");
    }

    const text = await request.text();

    if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
      return errorResponse(413, "That run is too big.");
    }

    let body: unknown;

    try {
      body = JSON.parse(text);
    } catch {
      return errorResponse(400, "The body isn't valid JSON.");
    }

    const parsed = runSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(400, "That isn't a valid run.", describeProblems(parsed.error));
    }

    const run = parsed.data;

    return safely("save the run", async () => {
      const isNew = await store.addRun(run);
      return Response.json({ id: run.id, alreadyStored: !isNew }, { status: isNew ? 201 : 200 });
    });
  }

  async function listRuns(): Promise<Response> {
    return safely("list the runs", async () => {
      const runs = await store.listRuns(RUN_LIST_LIMIT);
      return Response.json({ runs: runs.map(toSummary) });
    });
  }

  async function getRun(id: string): Promise<Response> {
    return safely("load the run", async () => {
      const run = RUN_ID_PATTERN.test(id) ? await store.getRun(id) : null;
      return run ? Response.json({ run }) : errorResponse(404, "No run with that id.");
    });
  }

  return { postRun, listRuns, getRun };
}
