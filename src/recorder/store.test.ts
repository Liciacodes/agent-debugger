import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listRuns, loadRun, newRunId, saveRun } from "./store";
import type { Run } from "./types";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "agent-runs-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

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
      {
        id: "s1",
        parentId: null,
        type: "model",
        name: "model call",
        round: 1,
        startMs: 0,
        durationMs: 800,
        tokens: 1400,
        input: "Where is the login function?",
        output: "In src/auth.ts.",
        reasoning: null,
        ok: true,
        error: null,
      },
    ],
  };
}

describe("run store", () => {
  it("gives back the same run after saving it", async () => {
    const run = makeRun("run_8f2a91c3", "2026-11-03T14:05:09.120Z");

    await saveRun(run, dir);

    expect(await loadRun("run_8f2a91c3", dir)).toEqual(run);
  });

  it("refuses to save over a run that's already saved", async () => {
    const run = makeRun("run_8f2a91c3", "2026-11-03T14:05:09.120Z");
    await saveRun(run, dir);

    await expect(saveRun(run, dir)).rejects.toThrow("already saved");
  });

  it("lists runs newest first", async () => {
    await saveRun(makeRun("run_00000002", "2026-11-03T12:00:00.000Z"), dir);
    await saveRun(makeRun("run_00000003", "2026-11-03T15:00:00.000Z"), dir);
    await saveRun(makeRun("run_00000001", "2026-11-02T09:00:00.000Z"), dir);

    const { runs } = await listRuns(dir);

    expect(runs.map((run) => run.id)).toEqual([
      "run_00000003",
      "run_00000002",
      "run_00000001",
    ]);
  });

  it("gives an empty list when nothing has been saved", async () => {
    expect(await listRuns(path.join(dir, "missing"))).toEqual({
      runs: [],
      unreadable: [],
    });
  });

  it("skips files that aren't saved runs and names them", async () => {
    await saveRun(makeRun("run_00000001", "2026-11-03T12:00:00.000Z"), dir);
    await writeFile(path.join(dir, "run_00000002.json"), "{ not json");
    await writeFile(path.join(dir, "run_00000003.json"), "{}");
    await writeFile(path.join(dir, "notes.json"), "[]");

    const { runs, unreadable } = await listRuns(dir);

    expect(runs.map((run) => run.id)).toEqual(["run_00000001"]);
    expect(unreadable.sort()).toEqual([
      "notes.json",
      "run_00000002.json",
      "run_00000003.json",
    ]);
  });

  it.each(["../.env.local", "run_1234", "RUN_8F2A91C3", "run_8f2a91c3/../x", ""])(
    "refuses %j as a run id",
    async (badId) => {
      await expect(loadRun(badId, dir)).rejects.toThrow("Not a run id");
      await expect(
        saveRun(makeRun(badId, "2026-11-03T12:00:00.000Z"), dir),
      ).rejects.toThrow("Not a run id");
    },
  );

  it("explains when no run has that id", async () => {
    await expect(loadRun("run_00000000", dir)).rejects.toThrow(
      "No saved run with id run_00000000",
    );
  });

  it("makes new ids in the run id format", () => {
    const first = newRunId();

    expect(first).toMatch(/^run_[0-9a-f]{8}$/);
    expect(newRunId()).not.toBe(first);
  });
});
