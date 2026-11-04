import { describe, expect, it } from "vitest";
import { trimText } from "../recorder/recorder";
import type { Run, Step } from "../recorder/types";
import { barFor, buildRows, stepLabel, stepNote, timeAxis, toolDetail } from "./waterfall";

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

const steps: Step[] = [
  step({ id: "s1", type: "model", durationMs: 820, tokens: 1400 }),
  step({ id: "s2", parentId: "s1", type: "tool", name: "read_file", input: '{"path":"src/cart.ts"}', startMs: 822, durationMs: 4 }),
  step({ id: "s3", type: "model", round: 2, startMs: 830, durationMs: 1100, output: "One test fails." }),
  step({ id: "s4", type: "answer", round: 2, startMs: 1930, output: "One test fails." }),
];

const run: Run = {
  id: "run_8f2a91c3",
  question: "Do the tests pass?",
  model: "fake-model",
  promptVersion: "v1",
  startedAt: "2026-11-03T14:05:09.120Z",
  status: "answered",
  answer: "One test fails.",
  error: null,
  steps,
};

describe("barFor", () => {
  it("places a bar by its start and length", () => {
    expect(barFor(1000, 500, 4000)).toEqual({ leftPercent: 25, widthPercent: 12.5 });
  });

  it("keeps a very short step visible", () => {
    expect(barFor(1000, 1, 4000).widthPercent).toBe(0.6);
  });

  it("keeps a zero-length answer at the end inside the track", () => {
    const bar = barFor(4000, 0, 4000);

    expect(bar.widthPercent).toBe(0.6);
    expect(bar.leftPercent + bar.widthPercent).toBeCloseTo(100);
  });

  it("doesn't divide by zero when the whole run took 0ms", () => {
    expect(barFor(0, 0, 0)).toEqual({ leftPercent: 0, widthPercent: 0.6 });
  });
});

describe("timeAxis", () => {
  it("marks every second of a 3.4s run, like the design", () => {
    const axis = timeAxis(3400);

    expect(axis.ticks.map((tick) => tick.label)).toEqual(["0s", "1s", "2s"]);
    expect(axis.endLabel).toBe("3.40s");
    expect(axis.gridPercent).toBeCloseTo(29.41, 1);
  });

  it("uses milliseconds for a short run", () => {
    expect(timeAxis(400).ticks.map((tick) => tick.label)).toEqual(["0s", "100ms", "200ms", "300ms"]);
  });

  it("uses wider steps for a long run", () => {
    expect(timeAxis(60_000).ticks.map((tick) => tick.label)).toEqual(["0s", "20s", "40s"]);
  });

  it("copes with a run that took 0ms", () => {
    expect(timeAxis(0).ticks).toEqual([{ percent: 0, label: "0s" }]);
  });
});

describe("stepLabel", () => {
  it("names model calls the design's way", () => {
    expect(stepLabel(steps[0], steps)).toBe("Plan next step");
    expect(stepLabel(steps[2], steps)).toBe("Decide");
    expect(stepLabel({ ...steps[2], ok: false, error: "Groq is down" }, steps)).toBe("Model call");
  });

  it("uses the tool's name, and Answer for the answer", () => {
    expect(stepLabel(steps[1], steps)).toBe("read_file");
    expect(stepLabel(steps[3], steps)).toBe("Answer");
  });
});

describe("toolDetail", () => {
  it.each([
    ['{"path":"src/cart.ts"}', "src/cart.ts"],
    ['{"query":"login","path":"src"}', '"login"'],
    ["{}", null],
    ["not json at all", "not json at all"],
    [null, null],
  ])("shows the main argument of %j", (input, expected) => {
    expect(toolDetail(input)).toBe(expected);
  });
});

describe("stepNote", () => {
  it("says what the chosen step did", () => {
    expect(stepNote(steps[0], steps, null).label).toBe("Model asked for 1 tool");
    expect(stepNote(steps[2], steps, null)).toEqual({
      label: "Model replied with no tool call",
      text: "One test fails.",
    });
  });

  it("shows the error of a failed tool", () => {
    const failed = { ...steps[1], ok: false, error: "Path not allowed." };

    expect(stepNote(failed, steps, null)).toEqual({ label: "The tool returned an error", text: "Path not allowed." });
  });

  it("explains Groq refusing a tool call, even when the step's copy was cut short", () => {
    const runError = `400 ${JSON.stringify({
      error: {
        message: "attempted to call tool 'write_file' which was not in request.tools",
        code: "tool_use_failed",
        failed_generation: JSON.stringify({ name: "write_file", arguments: { patch: "x".repeat(3_000) } }),
      },
    })}`;
    const failed = { ...steps[2], ok: false, error: trimText(runError) };

    expect(stepNote(failed, steps, runError)).toEqual({
      label: "The model call failed",
      text: "The model tried to call write_file, a tool it doesn't have.",
    });
  });
});

describe("buildRows", () => {
  it("numbers the steps and indents tools under their model call", () => {
    const rows = buildRows(run, 1930);

    expect(rows.map((row) => [row.number, row.depth, row.label, row.detail])).toEqual([
      [1, 0, "Plan next step", null],
      [2, 1, "read_file", "src/cart.ts"],
      [3, 0, "Decide", null],
      [4, 0, "Answer", null],
    ]);
  });
});
