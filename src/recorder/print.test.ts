import { describe, expect, it } from "vitest";
import { formatRunList, formatRunTree } from "./print";
import type { Run, Step } from "./types";

function step(fields: Partial<Step> & Pick<Step, "id" | "type" | "name">): Step {
  return {
    parentId: null,
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

const run: Run = {
  id: "run_8f2a91c3",
  question: "Why is calculateTotal wrong?",
  model: "fake-model",
  promptVersion: "v1",
  startedAt: "2026-11-03T14:05:09.120Z",
  status: "answered",
  answer: "One test fails.",
  error: null,
  steps: [
    step({ id: "s1", type: "model", name: "model call", durationMs: 820, tokens: 1400 }),
    step({ id: "s2", parentId: "s1", type: "tool", name: "list_files", input: "{}", startMs: 822, durationMs: 3 }),
    step({
      id: "s3",
      parentId: "s1",
      type: "tool",
      name: "read_file",
      input: '{"path":"../.env.local"}',
      startMs: 826,
      durationMs: 1,
      ok: false,
      error: "Path not allowed: ../.env.local",
    }),
    step({ id: "s4", type: "model", name: "model call", round: 2, startMs: 830, durationMs: 1100, tokens: 2100 }),
    step({ id: "s5", type: "answer", name: "answer", round: 2, startMs: 1930, output: "One test fails." }),
  ],
};

describe("formatRunTree", () => {
  const lines = formatRunTree(run).split("\n");
  const lineWith = (text: string) => lines.find((line) => line.includes(text)) ?? "";

  it("indents each tool under the model call that asked for it", () => {
    const modelColumn = lineWith("model call (round 1").indexOf("model call");

    expect(lineWith("list_files").indexOf("list_files")).toBe(modelColumn + 2);
    const answerLine = lines.find((line) => line.endsWith(" answer")) ?? "";

    expect(answerLine.indexOf("answer")).toBe(modelColumn);
  });

  it("shows when each step started and how long it took", () => {
    expect(lineWith("list_files")).toMatch(/822ms\s+3ms\s+list_files/);
    expect(lineWith("round 2")).toMatch(/830ms\s+1\.10s\s+model call \(round 2, 2\.1k tokens\)/);
  });

  it("shows the error on a failed step", () => {
    expect(lineWith("read_file")).toContain("ERROR: Path not allowed");
  });

  it("ends with the answer", () => {
    expect(lines.slice(-2)).toEqual(["ANSWER", "One test fails."]);
  });
});

describe("formatRunList", () => {
  it("shows one line per run", () => {
    const line = formatRunList([run]);

    expect(line).toContain("run_8f2a91c3");
    expect(line).toContain("answered");
    expect(line).toContain("5 steps");
    expect(line).toContain('"Why is calculateTotal wrong?"');
  });

  it("gives a hint when there are no saved runs", () => {
    expect(formatRunList([])).toContain("npm run agent");
  });
});
