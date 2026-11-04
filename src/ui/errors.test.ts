import { describe, expect, it } from "vitest";
import { trimText } from "../recorder/recorder";
import { readToolUseFailure, wholeStepError } from "./errors";

const UNKNOWN_TOOL_MESSAGE =
  "Tool call validation failed: tool call validation failed: attempted to call tool 'write_file' which was not in request.tools";

// Shaped like the real one from run_6b217b2e, with a shorter patch.
const REAL_ERROR =
  '400 {"error":{"message":"' +
  UNKNOWN_TOOL_MESSAGE +
  '","type":"invalid_request_error","code":"tool_use_failed","failed_generation":"{\\"name\\": \\"write_file\\", \\"arguments\\": {\\"path\\":\\"src/cart.ts\\",\\"patch\\":\\"*** Begin Patch\\\\n+// hello\\\\n*** End Patch\\"}\\n}"}}';

// A Groq error the way the SDK words it.
function groqError(message: string, generation?: string): string {
  const error = { message, type: "invalid_request_error", code: "tool_use_failed", failed_generation: generation };
  return `400 ${JSON.stringify({ error })}`;
}

describe("readToolUseFailure", () => {
  it("explains a call to a tool the model doesn't have", () => {
    expect(readToolUseFailure(REAL_ERROR)).toEqual({
      summary: "The model tried to call write_file, a tool it doesn't have.",
      tool: "write_file",
      args: [
        { name: "path", value: "src/cart.ts" },
        { name: "patch", value: "*** Begin Patch\n+// hello\n*** End Patch" },
      ],
      sent: null,
    });
  });

  it("reads arguments sent as a string of JSON, and spaces out values that aren't text", () => {
    const generation = JSON.stringify({ name: "search", arguments: JSON.stringify({ query: "total", limit: [1, 2] }) });
    expect(readToolUseFailure(groqError("Tool call validation failed", generation))?.args).toEqual([
      { name: "query", value: "total" },
      { name: "limit", value: "[\n  1,\n  2\n]" },
    ]);
  });

  it("shows no arguments as an empty list", () => {
    const failure = readToolUseFailure(groqError("Tool call validation failed", '{"name": "list_files"}'));
    expect(failure?.args).toEqual([]);
  });

  it("explains arguments that aren't valid JSON, and keeps them as written", () => {
    const generation = JSON.stringify({ name: "read_file", arguments: '{"path": "src/cart.ts"' });
    expect(readToolUseFailure(groqError("Failed to parse tool call arguments", generation))).toEqual({
      summary: "The model tried to call read_file, but what it sent wasn't valid JSON.",
      tool: "read_file",
      args: null,
      sent: '{"path": "src/cart.ts"',
    });
  });

  it("still finds the tool's name when the whole call is broken JSON", () => {
    const generation = '{"name": "read_file", "arguments": {"path": "src/cart.ts"\n}';
    expect(readToolUseFailure(groqError("Failed to parse tool call", generation))).toEqual({
      summary: "The model tried to call read_file, but what it sent wasn't valid JSON.",
      tool: "read_file",
      args: null,
      sent: generation,
    });
  });

  it("says less when it can't tell which tool it was", () => {
    const failure = readToolUseFailure(groqError("Failed to call a function", "<function=read_file"));
    expect(failure?.summary).toBe("The model sent a tool call that wasn't valid JSON.");
    expect(failure?.tool).toBeNull();
  });

  it("has a general message for other refusals", () => {
    const generation = JSON.stringify({ name: "read_file", arguments: {} });
    expect(readToolUseFailure(groqError("parameters for tool read_file did not match schema", generation))?.summary).toBe(
      "Groq rejected the model's call to read_file.",
    );
  });

  it("uses the name in Groq's message when it didn't say what the model sent", () => {
    expect(readToolUseFailure(groqError(UNKNOWN_TOOL_MESSAGE))).toEqual({
      summary: "The model tried to call write_file, a tool it doesn't have.",
      tool: "write_file",
      args: null,
      sent: null,
    });
  });

  it.each([
    ["a different Groq error", '429 {"error":{"message":"Rate limit reached","code":"rate_limit_exceeded"}}'],
    ["one of the agent's own errors", "The model returned no answer and no tool call."],
    ["an error that was cut short", trimText(groqError(UNKNOWN_TOOL_MESSAGE, "x".repeat(3_000)))],
  ])("gives null for %s", (_, error) => {
    expect(readToolUseFailure(error)).toBeNull();
  });
});

describe("wholeStepError", () => {
  it("uses the run's whole error when the step's copy was cut short", () => {
    const runError = groqError(UNKNOWN_TOOL_MESSAGE, JSON.stringify({ name: "write_file", arguments: { patch: "x".repeat(3_000) } }));
    const stepError = trimText(runError);

    expect(wholeStepError(stepError, runError)).toBe(runError);
    expect(readToolUseFailure(wholeStepError(stepError, runError) ?? "")?.tool).toBe("write_file");
  });

  it("keeps the step's own error otherwise", () => {
    expect(wholeStepError("File not found: src/nope.ts", "Hit the limit of 6 rounds without an answer.")).toBe(
      "File not found: src/nope.ts",
    );
    expect(wholeStepError("File not found: src/nope.ts", null)).toBe("File not found: src/nope.ts");
    expect(wholeStepError(null, "Hit the limit of 6 rounds without an answer.")).toBeNull();
  });
});
