import { trimText } from "../recorder/recorder";

// How the Groq SDK words an error: the status, then the JSON Groq sent back.
// 400 {"error":{"message":"...","code":"tool_use_failed","failed_generation":"..."}}
const GROQ_ERROR = /^\d{3} (\{[\s\S]*\})$/;
const UNKNOWN_TOOL = /attempted to call tool '([^']+)' which was not in request\.tools/;
// The tool's name at the start of what the model sent, for when the rest of it
// isn't valid JSON: {"name": "read_file", "arguments": ...
const NAME_AT_START = /^\s*\{\s*"name"\s*:\s*"([^"\\]+)"/;

export interface ToolArgument {
  name: string;
  value: string; // text keeps its line breaks; anything else is spaced-out JSON
}

// Why Groq said no: a tool the model doesn't have, a call that wasn't valid
// JSON, or something else.
export type ToolUseReason = "unknown_tool" | "invalid_json" | "rejected";

// Groq turning down a tool call the model made, in plain words.
export interface ToolUseFailure {
  reason: ToolUseReason;
  summary: string;
  tool: string | null;
  // The arguments one by one, when what the model sent could be read.
  args: ToolArgument[] | null;
  // What it sent, exactly as written, when it couldn't be read.
  sent: string | null;
}

interface Attempt {
  tool: string | null;
  args: ToolArgument[] | null;
  sent: string | null;
  validJson: boolean;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readArguments(args: Record<string, unknown>): ToolArgument[] {
  return Object.entries(args).map(([name, value]) => ({
    name,
    value: typeof value === "string" ? value : JSON.stringify(value, null, 2),
  }));
}

// `failed_generation` is what the model tried to send, as more JSON inside a
// string: {"name": "write_file", "arguments": {...}}. The arguments can also
// arrive as a string of their own.
function readAttempt(generation: string): Attempt {
  const call = parseJson(generation);

  if (!isObject(call) || typeof call.name !== "string") {
    const tool = NAME_AT_START.exec(generation)?.[1] ?? null;
    return { tool, args: null, sent: generation, validJson: call !== undefined };
  }

  const raw = call.arguments;
  const args = typeof raw === "string" ? parseJson(raw) : raw;

  if (typeof raw === "string" && args === undefined) {
    return { tool: call.name, args: null, sent: raw, validJson: false };
  }
  if (args === undefined) return { tool: call.name, args: [], sent: null, validJson: true };
  if (!isObject(args)) {
    return { tool: call.name, args: null, sent: JSON.stringify(args, null, 2), validJson: true };
  }
  return { tool: call.name, args: readArguments(args), sent: null, validJson: true };
}

function summaryFor(reason: ToolUseReason, tool: string | null): string {
  switch (reason) {
    case "unknown_tool":
      return `The model tried to call ${tool}, a tool it doesn't have.`;
    case "invalid_json":
      return tool
        ? `The model tried to call ${tool}, but what it sent wasn't valid JSON.`
        : "The model sent a tool call that wasn't valid JSON.";
    case "rejected":
      return tool ? `Groq rejected the model's call to ${tool}.` : "Groq rejected the model's tool call.";
  }
}

// Reads Groq's tool_use_failed error. Any other error, or one cut short, gives
// null, and is shown as it is.
export function readToolUseFailure(error: string): ToolUseFailure | null {
  const json = GROQ_ERROR.exec(error)?.[1];
  const body = json === undefined ? undefined : parseJson(json);
  if (!isObject(body) || !isObject(body.error) || body.error.code !== "tool_use_failed") return null;

  const { message, failed_generation: generation } = body.error;
  const unknownTool = typeof message === "string" ? (UNKNOWN_TOOL.exec(message)?.[1] ?? null) : null;
  const attempt = typeof generation === "string" ? readAttempt(generation) : null;
  const tool = unknownTool ?? attempt?.tool ?? null;
  const reason: ToolUseReason =
    unknownTool !== null ? "unknown_tool" : attempt?.validJson === false ? "invalid_json" : "rejected";

  return {
    reason,
    summary: summaryFor(reason, tool),
    tool,
    args: attempt?.args ?? null,
    sent: attempt?.sent ?? null,
  };
}

// A step keeps only the first 2,000 characters of an error, but the run keeps
// all of it. When the step's error is the run's cut short, use the run's, so a
// long Groq error can still be read.
export function wholeStepError(stepError: string | null, runError: string | null): string | null {
  if (stepError === null || runError === null) return stepError;
  return trimText(runError) === stepError ? runError : stepError;
}
