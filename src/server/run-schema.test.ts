import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { runAgent, type CallModel, type ModelReply } from "../agent/run-agent";
import { createRecorder } from "../recorder/recorder";
import type { Run } from "../recorder/types";
import { describeProblems, runSchema } from "./run-schema";

const rootDir = path.join(process.cwd(), "sample-project");

function reply(overrides: Partial<ModelReply>): ModelReply {
  return {
    content: null,
    reasoning: null,
    toolCalls: [],
    finishReason: "stop",
    totalTokens: 10,
    ...overrides,
  };
}

// A run made the real way: the real loop and recorder, with a fake model.
async function recordRun(script: (ModelReply | Error)[]): Promise<Run> {
  let index = 0;
  const recorder = createRecorder({ id: "run_0000abcd", model: "fake-model", promptVersion: "v1" });
  const callModel: CallModel = async () => {
    const next = script[index++];
    if (next instanceof Error) throw next;
    return next;
  };

  await runAgent({
    question: "Where is the login function?",
    callModel,
    rootDir,
    onStep: recorder.onStep,
  });
  return recorder.getRun();
}

function problemsWith(run: unknown): string[] {
  const result = runSchema.safeParse(run);
  return result.success ? [] : describeProblems(result.error);
}

let answeredRun: Run;

beforeAll(async () => {
  answeredRun = await recordRun([
    reply({
      finishReason: "tool_calls",
      toolCalls: [
        { id: "call_1", type: "function", function: { name: "read_file", arguments: '{"path":"src/auth.ts"}' } },
      ],
    }),
    reply({ content: "In src/auth.ts." }),
  ]);
});

describe("runSchema", () => {
  it("accepts a run made by the recorder", () => {
    expect(answeredRun.steps).toHaveLength(4);
    expect(problemsWith(answeredRun)).toEqual([]);
  });

  it("accepts a run that ended with an error", async () => {
    const failedRun = await recordRun([new Error("Groq is down")]);

    expect(failedRun.status).toBe("model_error");
    expect(problemsWith(failedRun)).toEqual([]);
  });

  it.each<[string, (run: Run) => void, string]>([
    ["a missing field", (run) => delete (run as Partial<Run>).question, "question:"],
    ["an unknown status", (run) => ((run as { status: string }).status = "finished"), "status:"],
    ["a badly shaped id", (run) => (run.id = "../.env.local"), "id: must look like run_8f2a91c3"],
    ["a start time that isn't a date", (run) => (run.startedAt = "yesterday"), "startedAt:"],
    ["a negative duration", (run) => (run.steps[1].durationMs = -5), "steps.1.durationMs:"],
    ["a token count that isn't whole", (run) => (run.steps[0].tokens = 1.5), "steps.0.tokens:"],
    ["an unknown step type", (run) => ((run.steps[0] as { type: string }).type = "thought"), "steps.0.type:"],
    ["a step id used twice", (run) => (run.steps[2].id = "s1"), "steps.2.id: s1 is used by more than one step"],
    [
      "a parent that isn't an earlier step",
      (run) => (run.steps[1].parentId = "s9"),
      "steps.1.parentId: s9 isn't an earlier step in this run",
    ],
    ["step text that's too long", (run) => (run.steps[1].output = "x".repeat(5_001)), "steps.1.output:"],
    [
      "too many steps",
      (run) => (run.steps = Array.from({ length: 201 }, (_, i) => ({ ...run.steps[0], id: `s${i + 1}` }))),
      "steps:",
    ],
  ])("rejects %s", (_, breakRun, expectedProblem) => {
    const run = structuredClone(answeredRun);
    breakRun(run);

    expect(problemsWith(run).join("\n")).toContain(expectedProblem);
  });
});
