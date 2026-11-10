import { describe, expect, it } from "vitest";
import type { Flag } from "../flags/types";
import type { Step } from "../recorder/types";
import { explainsError, flagTitle, stepTags } from "./flags";

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

function flag(fields: Partial<Flag> & Pick<Flag, "kind" | "severity">): Flag {
  return { stepId: null, tool: null, message: "", ...fields };
}

describe("flagTitle", () => {
  it("names the tool when there is one", () => {
    expect(flagTitle(flag({ kind: "unknown_tool", severity: "error", tool: "write_file" }))).toBe(
      "Unknown tool · write_file",
    );
    expect(flagTitle(flag({ kind: "round_limit", severity: "error" }))).toBe("Round limit");
  });
});

describe("explainsError", () => {
  it("is true when a flag says why the run stopped", () => {
    expect(explainsError([flag({ kind: "unknown_tool", severity: "error", stepId: "s5" })])).toBe(true);
    expect(explainsError([flag({ kind: "round_limit", severity: "error" })])).toBe(true);
  });

  it("is false when no flag says what the error says", () => {
    const flags = [
      flag({ kind: "tool_failed", severity: "error", stepId: "s2" }),
      flag({ kind: "repeated_call", severity: "warning", stepId: "s4" }),
      flag({ kind: "slow_step", severity: "warning", stepId: "s3" }),
    ];
    expect(explainsError(flags)).toBe(false);
    expect(explainsError([])).toBe(false);
  });
});

describe("stepTags", () => {
  it("shows the step's own flags, errors first", () => {
    const failedRead = step({ id: "s4", type: "tool", name: "read_file", ok: false });
    const flags = [
      flag({ kind: "repeated_call", severity: "warning", stepId: "s4" }),
      flag({ kind: "tool_failed", severity: "error", stepId: "s4" }),
      flag({ kind: "slow_step", severity: "warning", stepId: "s2" }),
    ];

    expect(stepTags(failedRead, flags)).toEqual([
      { text: "error", severity: "error" },
      { text: "repeated", severity: "warning" },
    ]);
  });

  it("says unknown tool instead of error when that's why the model call failed", () => {
    const failedCall = step({ id: "s5", type: "model", ok: false });
    const flags = [flag({ kind: "unknown_tool", severity: "error", stepId: "s5" })];

    expect(stepTags(failedCall, flags)).toEqual([{ text: "unknown tool", severity: "error" }]);
  });

  it("still says error for a failure no flag explains", () => {
    const cutOff = step({ id: "s3", type: "model", ok: false });
    const flags = [flag({ kind: "slow_step", severity: "warning", stepId: "s3" })];

    expect(stepTags(cutOff, flags)).toEqual([
      { text: "error", severity: "error" },
      { text: "slow", severity: "warning" },
    ]);
  });

  it("shows nothing for a step that went fine", () => {
    expect(stepTags(step({ id: "s1", type: "model" }), [])).toEqual([]);
  });
});
