import path from "node:path";
import { describe, expect, it } from "vitest";
import { runAgent, type CallModel, type ModelReply } from "../agent/run-agent";
import { createRecorder } from "./recorder";

const rootDir = path.join(process.cwd(), "sample-project");
const FAKE_KEY = "gsk_FakeKeyForTests1234567890";

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

function askForTools(...calls: [name: string, args: string][]): ModelReply {
  return reply({
    finishReason: "tool_calls",
    toolCalls: calls.map(([name, args], index) => ({
      id: `call_${index + 1}`,
      type: "function",
      function: { name, arguments: args },
    })),
  });
}

// Real Groq replies can leave a field out completely instead of sending null,
// even where the types say it's always there.
function withMissing(fullReply: ModelReply, ...fields: (keyof ModelReply)[]): ModelReply {
  const copy: Partial<ModelReply> = { ...fullReply };
  for (const field of fields) delete copy[field];
  return copy as ModelReply;
}

// Runs the real loop with a fake model and records it. Each model call moves
// the fake clock on by 100ms, so start offsets can be checked exactly. An Error
// in the script makes that model call throw, like Groq failing.
async function recordRun(
  script: (ModelReply | Error)[],
  { question = "Do the tests pass?", secrets = [] as string[] } = {},
) {
  let clock = 0;
  let index = 0;
  const recorder = createRecorder({
    id: "run_0000abcd",
    model: "fake-model",
    promptVersion: "v1",
    secrets,
    now: () => clock,
  });
  const callModel: CallModel = async () => {
    clock += 100;
    const next = script[index++];
    if (next instanceof Error) throw next;
    return next;
  };

  await runAgent({ question, callModel, rootDir, onStep: recorder.onStep });
  return recorder.getRun();
}

describe("createRecorder", () => {
  it("records an answered run as a tree of steps", async () => {
    const run = await recordRun([
      askForTools(["list_files", '{"path":"src"}']),
      reply({ content: "One test fails.", totalTokens: 20 }),
    ]);

    expect(run).toMatchObject({
      id: "run_0000abcd",
      question: "Do the tests pass?",
      model: "fake-model",
      promptVersion: "v1",
      status: "answered",
      answer: "One test fails.",
      error: null,
    });
    expect(Number.isNaN(Date.parse(run.startedAt))).toBe(false);
    expect(
      run.steps.map((step) => [step.id, step.parentId, step.type, step.name, step.startMs]),
    ).toEqual([
      ["s1", null, "model", "model call", 0],
      ["s2", "s1", "tool", "list_files", 100],
      ["s3", null, "model", "model call", 100],
      ["s4", null, "answer", "answer", 200],
    ]);
    expect(run.steps.map((step) => step.tokens)).toEqual([10, null, 20, null]);
    expect(run.steps.every((step) => step.ok)).toBe(true);
    expect(run.steps[1].input).toBe('{"path":"src"}');
    expect(run.steps[1].output).toContain("src/cart.ts");
    expect(run.steps[3].output).toBe("One test fails.");
  });

  it("stores only what was new to each model call as its input", async () => {
    const run = await recordRun([
      askForTools(["list_files", "{}"], ["read_file", '{"path":"src/cart.ts"}']),
      reply({ content: "Done." }),
    ]);
    const modelCalls = run.steps.filter((step) => step.type === "model");

    expect(modelCalls.map((step) => step.input)).toEqual([
      "Do the tests pass?",
      "results of list_files, read_file",
    ]);
  });

  it("marks a refused tool call as failed and keeps going", async () => {
    const run = await recordRun([
      askForTools(["read_file", '{"path":"../.env.local"}']),
      reply({ content: "I can't read that." }),
    ]);
    const tool = run.steps[1];

    expect(tool.type).toBe("tool");
    expect(tool.ok).toBe(false);
    expect(tool.error).toContain("Path not allowed");
    expect(run.status).toBe("answered");
  });

  it("marks the model call as failed when Groq throws", async () => {
    const run = await recordRun([new Error("Groq is down")]);

    expect(run.status).toBe("model_error");
    expect(run.error).toBe("Groq is down");
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0]).toMatchObject({
      type: "model",
      ok: false,
      error: "Groq is down",
      durationMs: 100,
    });
  });

  it.each<[string, ModelReply, string]>([
    ["cut-off output", reply({ content: "All tests p", finishReason: "length" }), "cut_off"],
    ["an empty reply", reply({ content: "  " }), "model_error"],
  ])("marks the model call as failed after %s", async (_, badReply, status) => {
    const run = await recordRun([badReply]);

    expect(run.status).toBe(status);
    expect(run.answer).toBeNull();
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0].ok).toBe(false);
    expect(run.steps[0].error).toBe(run.error);
  });

  it("records a run that hits the round limit", async () => {
    const run = await recordRun(
      Array.from({ length: 6 }, () => askForTools(["list_files", "{}"])),
    );

    expect(run.status).toBe("max_rounds");
    expect(run.error).toContain("6 rounds");
    expect(run.steps.filter((step) => step.type === "model")).toHaveLength(6);
    expect(run.steps.filter((step) => step.type === "tool")).toHaveLength(6);
    expect(run.steps.some((step) => step.type === "answer")).toBe(false);
    expect(run.steps.every((step) => step.ok)).toBe(true);
  });

  it("handles fields that a real reply leaves out", async () => {
    const run = await recordRun(
      [
        withMissing(askForTools(["list_files", "{}"]), "content", "reasoning", "totalTokens"),
        withMissing(reply({ content: "Done." }), "reasoning", "totalTokens"),
      ],
      // The real command always passes the key in, so test that path too.
      { secrets: [FAKE_KEY] },
    );

    expect(run.status).toBe("answered");
    expect(run.steps[0]).toMatchObject({ output: null, reasoning: null, tokens: null });
    expect(run.steps[2]).toMatchObject({ output: "Done.", reasoning: null, tokens: null });
    // Missing fields are saved as null, so every saved step has the same fields.
    expect(Object.keys(JSON.parse(JSON.stringify(run.steps[0])))).toEqual(
      Object.keys(run.steps[1]),
    );
  });

  it("never stores a key", async () => {
    const run = await recordRun(
      [
        askForTools(["read_file", JSON.stringify({ path: FAKE_KEY })]),
        reply({
          content: `The key is ${FAKE_KEY}, and the password is my-other-secret`,
          reasoning: `Thinking about ${FAKE_KEY}`,
        }),
      ],
      {
        question: `Do the tests pass? My key is ${FAKE_KEY}`,
        secrets: ["my-other-secret", "es"],
      },
    );
    const saved = JSON.stringify(run);

    expect(saved).not.toContain(FAKE_KEY);
    expect(saved).not.toContain("my-other-secret");
    expect(saved).toContain("[hidden key]");
    // Too short to count as a secret, so ordinary words are left alone.
    expect(run.question).toContain("tests");
  });

  it("trims long step text but keeps the whole answer", async () => {
    const longAnswer = "x".repeat(10_000);
    const run = await recordRun([reply({ content: longAnswer })]);

    expect(run.steps[0].output).toBe(
      `${"x".repeat(2_000)}\n[trimmed: 8000 more characters]`,
    );
    expect(run.answer).toBe(longAnswer);
  });
});
