import { describe, expect, it } from "vitest";
import { describeSendResult, importRuns, sendRun, type SendResult } from "./send";
import type { Run } from "./types";

const TOKEN = "a-long-test-token-123456";
const URL_ = "http://localhost:3000";

function makeRun(id: string): Run {
  return {
    id,
    question: "Where is the login function?",
    model: "fake-model",
    promptVersion: "v1",
    startedAt: "2026-11-03T14:05:09.120Z",
    status: "answered",
    answer: "In src/auth.ts.",
    error: null,
    steps: [],
  };
}

// A fake fetch that answers with a status and body, and remembers the request.
function fakeFetch(status: number, body: unknown = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: URL, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return Response.json(body, { status });
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

describe("sendRun", () => {
  it("posts the run with the token and reports it stored", async () => {
    const { calls, fetchFn } = fakeFetch(201);
    const run = makeRun("run_8f2a91c3");

    const result = await sendRun(run, { url: URL_, token: TOKEN, fetchFn });

    expect(result).toEqual({ outcome: "stored" });
    expect(calls[0].url).toBe("http://localhost:3000/api/runs");
    expect(calls[0].init.method).toBe("POST");
    expect((calls[0].init.headers as Record<string, string>)["x-recorder-token"]).toBe(TOKEN);
    expect(JSON.parse(calls[0].init.body as string)).toEqual(run);
  });

  it("reports a run the server already has", async () => {
    const { fetchFn } = fakeFetch(200);

    expect(await sendRun(makeRun("run_8f2a91c3"), { url: URL_, token: TOKEN, fetchFn })).toEqual({
      outcome: "already_stored",
    });
  });

  it("explains when the server isn't running", async () => {
    const fetchFn = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const result = await sendRun(makeRun("run_8f2a91c3"), { url: URL_, token: TOKEN, fetchFn });

    expect(result).toMatchObject({ outcome: "failed", unreachable: true });
    expect(result.outcome === "failed" && result.reason).toContain("npm run dev");
  });

  it("passes on the server's reason for refusing", async () => {
    const { fetchFn } = fakeFetch(401, { error: "Wrong recorder token." });

    const result = await sendRun(makeRun("run_8f2a91c3"), { url: URL_, token: TOKEN, fetchFn });

    expect(result).toEqual({
      outcome: "failed",
      reason: "the server answered 401: Wrong recorder token.",
      unreachable: false,
    });
  });

  it("doesn't send anything without a token", async () => {
    const { calls, fetchFn } = fakeFetch(201);

    const result = await sendRun(makeRun("run_8f2a91c3"), { url: URL_, token: undefined, fetchFn });

    expect(result).toMatchObject({ outcome: "failed", unreachable: false });
    expect(calls).toHaveLength(0);
  });
});

describe("describeSendResult", () => {
  it("doesn't double the full stop after the server's message", () => {
    const result: SendResult = {
      outcome: "failed",
      reason: "the server answered 401: Wrong recorder token.",
      unreachable: false,
    };

    expect(describeSendResult(result, URL_)).toBe(
      "not sent: the server answered 401: Wrong recorder token. It's saved in runs/, so npm run import can send it later.",
    );
  });
});

describe("importRuns", () => {
  it("counts what happened to each run", async () => {
    const results: Record<string, SendResult> = {
      run_00000001: { outcome: "stored" },
      run_00000002: { outcome: "already_stored" },
      run_00000003: { outcome: "failed", reason: "the server answered 400", unreachable: false },
      run_00000004: { outcome: "stored" },
    };
    const runs = Object.keys(results).map(makeRun);

    const tally = await importRuns(runs, async (run) => results[run.id]);

    expect(tally).toEqual({
      stored: 2,
      alreadyStored: 1,
      failed: [{ id: "run_00000003", reason: "the server answered 400" }],
      notTried: 0,
    });
  });

  it("stops early when the server stops answering", async () => {
    const runs = ["run_00000001", "run_00000002", "run_00000003"].map(makeRun);
    const tried: string[] = [];

    const tally = await importRuns(runs, async (run) => {
      tried.push(run.id);
      return { outcome: "failed", reason: "not reachable", unreachable: true };
    });

    expect(tried).toEqual(["run_00000001"]);
    expect(tally.failed).toHaveLength(1);
    expect(tally.notTried).toBe(2);
  });
});
