import { describe, expect, it } from "vitest";
import type { Run, Step } from "../recorder/types";
import { createRunsApi, type RunStore } from "./runs-api";

const TOKEN = "a-long-test-token-123456";

// Keeps runs in memory, so these tests need no database.
function memoryStore(): RunStore & { runs: Map<string, Run> } {
  const runs = new Map<string, Run>();

  return {
    runs,
    async addRun(run) {
      if (runs.has(run.id)) return false;
      runs.set(run.id, structuredClone(run));
      return true;
    },
    async listRuns(limit) {
      return [...runs.values()]
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, limit);
    },
    async getRun(id) {
      return runs.get(id) ?? null;
    },
  };
}

function step(fields: Partial<Step> & Pick<Step, "id" | "type">): Step {
  return {
    parentId: null,
    name: fields.type,
    round: 1,
    startMs: 0,
    durationMs: 0,
    tokens: null,
    input: null,
    output: null,
    reasoning: null,
    ok: true,
    error: null,
    ...fields,
  };
}

function makeRun(id: string, startedAt: string): Run {
  return {
    id,
    question: "Where is the login function?",
    model: "fake-model",
    promptVersion: "v1",
    startedAt,
    status: "answered",
    answer: "In src/auth.ts.",
    error: null,
    steps: [
      step({ id: "s1", type: "model", durationMs: 800, tokens: 1400 }),
      step({ id: "s2", parentId: "s1", type: "tool", name: "read_file", startMs: 805, durationMs: 4 }),
      step({ id: "s3", type: "model", round: 2, startMs: 812, durationMs: 600, tokens: 1500 }),
      step({ id: "s4", type: "answer", round: 2, startMs: 1412 }),
    ],
  };
}

function postRequest(body: string, headers: Record<string, string> = { "x-recorder-token": TOKEN }) {
  return new Request("http://localhost/api/runs", { method: "POST", headers, body });
}

// null stands for "RECORDER_TOKEN isn't set on the server". (undefined can't:
// it would be swapped for the default.)
function setup(serverToken: string | null = TOKEN) {
  const store = memoryStore();
  return { store, api: createRunsApi(store, () => serverToken ?? undefined) };
}

describe("POST /api/runs", () => {
  it("stores a new run, then says it's already stored", async () => {
    const { store, api } = setup();
    const run = makeRun("run_8f2a91c3", "2026-11-03T14:05:09.120Z");

    const first = await api.postRun(postRequest(JSON.stringify(run)));
    const second = await api.postRun(postRequest(JSON.stringify(run)));

    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({ id: "run_8f2a91c3", alreadyStored: false });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ id: "run_8f2a91c3", alreadyStored: true });
    expect(store.runs.get("run_8f2a91c3")).toEqual(run);
  });

  it.each<[string, Record<string, string>, string | null, number]>([
    ["no token", {}, TOKEN, 401],
    ["a wrong token", { "x-recorder-token": "a-long-wrong-token-000000" }, TOKEN, 401],
    ["no token set on the server", { "x-recorder-token": TOKEN }, null, 503],
  ])("refuses a run sent with %s", async (_, headers, serverToken, status) => {
    const { store, api } = setup(serverToken);
    const run = makeRun("run_8f2a91c3", "2026-11-03T14:05:09.120Z");

    const response = await api.postRun(postRequest(JSON.stringify(run), headers));

    expect(response.status).toBe(status);
    expect(store.runs.size).toBe(0);
  });

  it("refuses a body that isn't JSON", async () => {
    const { api } = setup();

    const response = await api.postRun(postRequest("{ not json"));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("isn't valid JSON");
  });

  it("refuses an invalid run and lists the problems", async () => {
    const { store, api } = setup();
    const run = makeRun("run_8f2a91c3", "2026-11-03T14:05:09.120Z");
    run.steps[1].durationMs = -5;

    const response = await api.postRun(postRequest(JSON.stringify(run)));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.problems[0]).toContain("steps.1.durationMs");
    expect(store.runs.size).toBe(0);
  });

  it("refuses a body over 1 MB", async () => {
    const { api } = setup();

    const response = await api.postRun(postRequest("x".repeat(1_000_001)));

    expect(response.status).toBe(413);
  });

  it("answers 500 with a plain message when saving fails", async () => {
    const { store, api } = setup();
    store.addRun = async () => {
      throw new Error("connection refused at db.internal:5432");
    };

    const response = await api.postRun(
      postRequest(JSON.stringify(makeRun("run_8f2a91c3", "2026-11-03T14:05:09.120Z"))),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("db.internal");
  });
});

describe("GET /api/runs", () => {
  it("lists runs newest first, with step counts and durations", async () => {
    const { api } = setup();
    await api.postRun(postRequest(JSON.stringify(makeRun("run_00000001", "2026-11-02T09:00:00.000Z"))));
    await api.postRun(postRequest(JSON.stringify(makeRun("run_00000002", "2026-11-03T15:00:00.000Z"))));

    const response = await api.listRuns();
    const { runs } = await response.json();

    expect(response.status).toBe(200);
    expect(runs).toEqual([
      {
        id: "run_00000002",
        question: "Where is the login function?",
        status: "answered",
        startedAt: "2026-11-03T15:00:00.000Z",
        stepCount: 4,
        durationMs: 1412,
      },
      expect.objectContaining({ id: "run_00000001" }),
    ]);
  });
});

describe("GET /api/runs/[id]", () => {
  it("gives back one run with its steps in order", async () => {
    const { api } = setup();
    const run = makeRun("run_8f2a91c3", "2026-11-03T14:05:09.120Z");
    await api.postRun(postRequest(JSON.stringify(run)));

    const response = await api.getRun("run_8f2a91c3");

    expect(response.status).toBe(200);
    expect((await response.json()).run).toEqual(run);
  });

  it.each(["run_00000000", "../.env.local", "not-a-run"])("answers 404 for %j", async (id) => {
    const { api } = setup();

    expect((await api.getRun(id)).status).toBe(404);
  });
});
