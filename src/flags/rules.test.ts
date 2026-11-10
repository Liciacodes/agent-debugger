import { describe, expect, it } from "vitest";
import { trimText } from "../recorder/recorder";
import type { Run, Step } from "../recorder/types";
import { failedToolCalls, roundLimit, slowSteps, unknownToolCalls } from "./rules";

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

// A Groq refusal shaped like the real one in run_6b217b2e.
function unknownToolError(args: Record<string, unknown>): string {
  return `400 ${JSON.stringify({
    error: {
      message: "Tool call validation failed: attempted to call tool 'write_file' which was not in request.tools",
      type: "invalid_request_error",
      code: "tool_use_failed",
      failed_generation: JSON.stringify({ name: "write_file", arguments: args }),
    },
  })}`;
}

describe("failedToolCalls", () => {
  it("flags each tool call that returned an error, and nothing else", () => {
    const steps = [
      step({ id: "s1", type: "model", ok: false, error: "The model returned no answer and no tool call." }),
      step({ id: "s2", type: "tool", name: "read_file", ok: false, error: "File not found: src/nope.ts" }),
      step({ id: "s3", type: "tool", name: "list_files" }),
    ];

    expect(failedToolCalls(run(steps))).toEqual([
      {
        kind: "tool_failed",
        severity: "error",
        stepId: "s2",
        tool: "read_file",
        message: "`read_file` returned an error instead of a result.",
      },
    ]);
  });
});

describe("unknownToolCalls", () => {
  it("points at the model call Groq turned down, like s5 in run_6b217b2e", () => {
    const error = unknownToolError({ path: "src/cart.ts" });
    const steps = [
      step({ id: "s4", type: "tool", name: "read_file" }),
      step({ id: "s5", type: "model", round: 3, ok: false, error }),
    ];

    expect(unknownToolCalls(run(steps, { status: "model_error", answer: null, error }))).toEqual([
      {
        kind: "unknown_tool",
        severity: "error",
        stepId: "s5",
        tool: "write_file",
        message:
          "The model asked for `write_file`, which isn't one of its tools, so Groq refused the request and the run stopped.",
      },
    ]);
  });

  it("reads the run's whole error when the step's copy was cut short", () => {
    const error = unknownToolError({ patch: "x".repeat(3_000) });
    const steps = [step({ id: "s1", type: "model", ok: false, error: trimText(error) })];

    expect(unknownToolCalls(run(steps, { status: "model_error", error }))[0]?.tool).toBe("write_file");
  });

  it("leaves other model errors alone", () => {
    const steps = [
      step({ id: "s1", type: "model", ok: false, error: "The model ran out of output tokens before finishing." }),
      step({
        id: "s2",
        type: "model",
        ok: false,
        error: `400 ${JSON.stringify({ error: { message: "bad", code: "tool_use_failed", failed_generation: "{oops" } })}`,
      }),
    ];

    expect(unknownToolCalls(run(steps))).toEqual([]);
  });
});

describe("roundLimit", () => {
  it("points at the whole run when it used every round", () => {
    const steps = [1, 2, 3, 4, 5, 6].map((round) => step({ id: `s${round}`, type: "model", round }));

    expect(roundLimit(run(steps, { status: "max_rounds", answer: null }))).toEqual([
      {
        kind: "round_limit",
        severity: "error",
        stepId: null,
        tool: null,
        message: "The model kept calling tools for all 6 rounds and never gave an answer.",
      },
    ]);
  });

  it("finds nothing in a run that answered", () => {
    expect(roundLimit(run([step({ id: "s1", type: "model" })]))).toEqual([]);
  });
});

describe("slowSteps", () => {
  // Real timings from run_ce2adda3: the first model call took 53% of 1.93s.
  it("leaves a quick run alone, even when one step took over half of it", () => {
    const steps = [
      step({ id: "s1", type: "model", startMs: 0, durationMs: 1021 }),
      step({ id: "s2", type: "tool", name: "search_code", startMs: 1023, durationMs: 51 }),
      step({ id: "s3", type: "model", startMs: 1076, durationMs: 474 }),
      step({ id: "s4", type: "tool", name: "read_file", startMs: 1552, durationMs: 6 }),
      step({ id: "s5", type: "model", startMs: 1559, durationMs: 374 }),
      step({ id: "s6", type: "answer", startMs: 1933 }),
    ];

    expect(slowSteps(run(steps))).toEqual([]);
  });

  it("flags a step that took most of a longer run", () => {
    const steps = [
      step({ id: "s1", type: "model", startMs: 0, durationMs: 1000 }),
      step({ id: "s2", type: "tool", name: "run_tests", startMs: 1002, durationMs: 5000 }),
      step({ id: "s3", type: "model", startMs: 6010, durationMs: 800 }),
    ];

    expect(slowSteps(run(steps))).toEqual([
      {
        kind: "slow_step",
        severity: "warning",
        stepId: "s2",
        tool: "run_tests",
        message: "This step took 73% of the run: 5.00s of 6.81s.",
      },
    ]);
  });

  it("doesn't flag a long step that took less than half the run", () => {
    const steps = [
      step({ id: "s1", type: "model", startMs: 0, durationMs: 2500 }),
      step({ id: "s2", type: "tool", name: "read_file", startMs: 2500, durationMs: 100 }),
      step({ id: "s3", type: "model", startMs: 2600, durationMs: 2500 }),
    ];

    expect(slowSteps(run(steps))).toEqual([]);
  });
});
