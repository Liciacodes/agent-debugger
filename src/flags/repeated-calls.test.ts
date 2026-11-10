import { describe, expect, it } from "vitest";
import type { Step } from "../recorder/types";
import { findRepeatedCalls } from "./repeated-calls";

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

const READ_AUTH = '{"path":"src/auth.ts"}';

// The steps of your real run_ce2adda3, "Where is the login function?".
const loginRun: Step[] = [
  step({ id: "s1", type: "model", input: "Where is the login function?" }),
  step({ id: "s2", type: "tool", name: "search_code", input: '{"path":"","query":"login"}' }),
  step({ id: "s3", type: "model", input: "results of search_code" }),
  step({ id: "s4", type: "tool", name: "read_file", input: READ_AUTH }),
  step({ id: "s5", type: "model", input: "results of read_file" }),
  step({ id: "s6", type: "answer" }),
];

// The same run if the model had read src/auth.ts again in round 3.
const readTwice: Step[] = [
  ...loginRun.slice(0, 5),
  step({ id: "s6", type: "tool", name: "read_file", input: READ_AUTH }),
  step({ id: "s7", type: "model", input: "results of read_file" }),
  step({ id: "s8", type: "answer" }),
];

describe("findRepeatedCalls", () => {
  it("finds nothing in run_ce2adda3, where every call was different", () => {
    expect(findRepeatedCalls(loginRun)).toEqual([]);
  });

  it("finds the second read of the same file", () => {
    expect(findRepeatedCalls(readTwice)).toEqual(["s6"]);
  });

  it("counts every later copy, but never the first one", () => {
    const readThreeTimes = [
      ...readTwice.slice(0, 7),
      step({ id: "s8", type: "tool", name: "read_file", input: READ_AUTH }),
    ];
    expect(findRepeatedCalls(readThreeTimes)).toEqual(["s6", "s8"]);
  });

  it("isn't fooled by the same tool with different arguments", () => {
    const steps = [
      step({ id: "s1", type: "tool", name: "read_file", input: READ_AUTH }),
      step({ id: "s2", type: "tool", name: "read_file", input: '{"path":"src/cart.ts"}' }),
    ];
    expect(findRepeatedCalls(steps)).toEqual([]);
  });

  it("isn't fooled by different tools with the same arguments", () => {
    const steps = [
      step({ id: "s1", type: "tool", name: "list_files", input: '{"path":"src"}' }),
      step({ id: "s2", type: "tool", name: "read_file", input: '{"path":"src"}' }),
    ];
    expect(findRepeatedCalls(steps)).toEqual([]);
  });

  it("only looks at tool calls", () => {
    const steps = [
      step({ id: "s1", type: "model", input: "results of read_file" }),
      step({ id: "s2", type: "model", input: "results of read_file" }),
    ];
    expect(findRepeatedCalls(steps)).toEqual([]);
  });

  // Like run_tests in your run_6b217b2e, whose arguments were just {}.
  it("counts calls with no arguments", () => {
    const steps = [
      step({ id: "s2", type: "tool", name: "run_tests", input: "{}" }),
      step({ id: "s4", type: "tool", name: "run_tests", input: "{}" }),
    ];
    expect(findRepeatedCalls(steps)).toEqual(["s4"]);
  });

  it("counts a retry of a call that failed", () => {
    const steps = [
      step({ id: "s2", type: "tool", name: "read_file", input: '{"path":"src/nope.ts"}', ok: false }),
      step({ id: "s4", type: "tool", name: "read_file", input: '{"path":"src/nope.ts"}', ok: false }),
    ];
    expect(findRepeatedCalls(steps)).toEqual(["s4"]);
  });

  it("gives an empty list for a run with no steps", () => {
    expect(findRepeatedCalls([])).toEqual([]);
  });
});
