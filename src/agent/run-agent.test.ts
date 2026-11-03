import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_ROUNDS, runAgent, type CallModel, type ModelReply } from "./run-agent";

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

function askForTool(args: string): ModelReply {
  return reply({
    finishReason: "tool_calls",
    toolCalls: [
      {
        id: "call_1",
        type: "function",
        function: { name: "list_files", arguments: args },
      },
    ],
  });
}

describe("runAgent", () => {
  it("stops after 6 rounds if the model never answers", async () => {
    let modelCalls = 0;
    const callModel: CallModel = async () => {
      modelCalls += 1;
      return askForTool("{}");
    };

    const result = await runAgent({ question: "Hi", callModel, rootDir });

    expect(MAX_ROUNDS).toBe(6);
    expect(modelCalls).toBe(6);
    expect(result.status).toBe("max_rounds");
    expect(result.answer).toBeNull();
    expect(result.toolCallCount).toBe(6);
  });

  it("returns the answer when the model replies without a tool call", async () => {
    const callModel: CallModel = async () => reply({ content: "Hello" });

    const result = await runAgent({ question: "Hi", callModel, rootDir });

    expect(result.status).toBe("answered");
    expect(result.answer).toBe("Hello");
    expect(result.rounds).toBe(1);
  });

  it("gives a refused path back to the model and keeps going", async () => {
    const seenToolMessages: unknown[] = [];
    const callModel: CallModel = async (messages) => {
      const last = messages.at(-1);
      if (last?.role === "tool") {
        seenToolMessages.push(last.content);
        return reply({ content: "I can't read that." });
      }
      return askForTool('{"path":"../.env.local"}');
    };

    const result = await runAgent({ question: "Hi", callModel, rootDir });

    expect(result.status).toBe("answered");
    expect(result.rounds).toBe(2);
    expect(seenToolMessages).toHaveLength(1);
    expect(seenToolMessages[0]).toContain("Path not allowed");
  });

  it("reports a model failure instead of crashing", async () => {
    const callModel: CallModel = async () => {
      throw new Error("Groq is down");
    };

    const result = await runAgent({ question: "Hi", callModel, rootDir });

    expect(result.status).toBe("model_error");
    expect(result.error).toBe("Groq is down");
  });

  it("does not treat cut-off output as an answer", async () => {
    const callModel: CallModel = async () =>
      reply({ content: "All tests p", finishReason: "length" });

    const result = await runAgent({ question: "Hi", callModel, rootDir });

    expect(result.status).toBe("cut_off");
    expect(result.answer).toBeNull();
  });

  it("does not treat an empty reply as an answer", async () => {
    const callModel: CallModel = async () => reply({ content: "  " });

    const result = await runAgent({ question: "Hi", callModel, rootDir });

    expect(result.status).toBe("model_error");
    expect(result.answer).toBeNull();
  });
});
