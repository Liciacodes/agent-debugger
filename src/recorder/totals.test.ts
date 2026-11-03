import { describe, expect, it } from "vitest";
import { computeTotals } from "./totals";
import type { Run, Step } from "./types";

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

function runWith(steps: Step[]): Run {
  return {
    id: "run_00000000",
    question: "Do the tests pass?",
    model: "fake-model",
    promptVersion: "v1",
    startedAt: "2026-11-03T14:00:00.000Z",
    status: "answered",
    answer: "No, one test fails.",
    error: null,
    steps,
  };
}

// 2 model calls and 2 tool calls (one of them failed), then the answer.
const normalRun = runWith([
  step({ id: "s1", type: "model", startMs: 0, durationMs: 800, tokens: 1000 }),
  step({ id: "s2", parentId: "s1", type: "tool", name: "list_files", startMs: 805, durationMs: 5 }),
  step({
    id: "s3",
    parentId: "s1",
    type: "tool",
    name: "read_file",
    startMs: 812,
    durationMs: 3,
    ok: false,
    error: "Path not allowed",
  }),
  step({ id: "s4", type: "model", round: 2, startMs: 820, durationMs: 1100, tokens: 1500 }),
  step({ id: "s5", type: "answer", round: 2, startMs: 1920 }),
]);

describe("computeTotals", () => {
  it("adds up a normal run", () => {
    expect(computeTotals(normalRun)).toEqual({
      durationMs: 1920,
      tokens: 2500,
      modelCalls: 2,
      toolCalls: 2,
      failedToolCalls: 1,
    });
  });

  it("uses when the last step ends, not the sum of the durations", () => {
    // The durations add up to 1908ms, but there are small gaps between steps.
    expect(computeTotals(normalRun).durationMs).toBe(1920);
  });

  it("counts unknown tokens as 0", () => {
    const run = runWith([
      step({ id: "s1", type: "model", durationMs: 500, tokens: null }),
      step({ id: "s2", type: "model", round: 2, startMs: 510, durationMs: 400, tokens: 700 }),
    ]);

    expect(computeTotals(run).tokens).toBe(700);
  });

  it("gives all zeros for a run with no steps", () => {
    expect(computeTotals(runWith([]))).toEqual({
      durationMs: 0,
      tokens: 0,
      modelCalls: 0,
      toolCalls: 0,
      failedToolCalls: 0,
    });
  });

  it("does not count a failed model call as a failed tool call", () => {
    const run = runWith([
      step({ id: "s1", type: "model", durationMs: 300, ok: false, error: "Groq is down" }),
    ]);

    expect(computeTotals(run)).toEqual({
      durationMs: 300,
      tokens: 0,
      modelCalls: 1,
      toolCalls: 0,
      failedToolCalls: 0,
    });
  });
});
