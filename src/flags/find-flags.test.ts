import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Run, Step } from "../recorder/types";
import { findFlags } from "./find-flags";
import { findRepeatedCalls } from "./repeated-calls";

// findRepeatedCalls has its own tests in repeated-calls.test.ts. Here a
// stand-in answers for it, so these tests work whether it's written or not.
vi.mock("./repeated-calls", () => ({ findRepeatedCalls: vi.fn() }));

function step(fields: Partial<Step> & Pick<Step, "id" | "type">): Step {
  return {
    parentId: null,
    name: fields.type === "model" ? "model call" : fields.type,
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

function run(steps: Step[], fields: Partial<Run> = {}): Run {
  return {
    id: "run_8f2a91c3",
    question: "Do the tests pass?",
    model: "fake-model",
    promptVersion: "v1",
    startedAt: "2026-11-10T14:05:09.120Z",
    status: "answered",
    answer: "One test fails.",
    error: null,
    steps,
    ...fields,
  };
}

beforeEach(() => {
  vi.mocked(findRepeatedCalls).mockReturnValue([]);
});

describe("findFlags", () => {
  it("finds nothing in a run that went fine", () => {
    const steps = [
      step({ id: "s1", type: "model", durationMs: 800 }),
      step({ id: "s2", type: "tool", name: "read_file", startMs: 800, durationMs: 5 }),
      step({ id: "s3", type: "model", startMs: 810, durationMs: 700 }),
      step({ id: "s4", type: "answer", startMs: 1510 }),
    ];

    expect(findFlags(run(steps))).toEqual([]);
  });

  it("turns the ids of repeated calls into flags", () => {
    vi.mocked(findRepeatedCalls).mockReturnValue(["s4"]);
    const steps = [
      step({ id: "s2", type: "tool", name: "read_file", input: '{"path":"src/auth.ts"}' }),
      step({ id: "s4", type: "tool", name: "read_file", input: '{"path":"src/auth.ts"}' }),
    ];

    expect(findFlags(run(steps))).toEqual([
      {
        kind: "repeated_call",
        severity: "warning",
        stepId: "s4",
        tool: "read_file",
        message: "`read_file` was already called with exactly these arguments earlier in the run.",
      },
    ]);
  });

  it("puts whole-run flags first, then follows the steps, errors before warnings", () => {
    vi.mocked(findRepeatedCalls).mockReturnValue(["s2"]);
    const steps = [
      step({ id: "s1", type: "model", durationMs: 5000 }),
      step({ id: "s2", type: "tool", name: "read_file", startMs: 5000, durationMs: 10, ok: false }),
      step({ id: "s3", type: "model", round: 2, startMs: 5010, durationMs: 490 }),
    ];
    const flags = findFlags(run(steps, { status: "max_rounds", answer: null }));

    expect(flags.map((flag) => [flag.kind, flag.stepId])).toEqual([
      ["round_limit", null],
      ["slow_step", "s1"],
      ["tool_failed", "s2"],
      ["repeated_call", "s2"],
    ]);
  });
});
