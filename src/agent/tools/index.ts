import type { ChatCompletionTool } from "groq-sdk/resources/chat/completions";
import { listFiles, readFile, searchCode } from "./files";
import { runTests } from "./run-tests";
import { ToolError, type ToolResult } from "./types";

const PATH_HELP = "Path relative to the project root, for example src/cart.ts.";

// Kept neutral on purpose: nothing here tells the model when it must run tests.
export const TOOL_DEFINITIONS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List the files in the project, or in one folder of it.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: PATH_HELP } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read one file from the project.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: PATH_HELP } },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_code",
      description:
        "Search the project's files for exact text, ignoring case. Returns the matching lines.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The text to look for." },
          path: { type: "string", description: PATH_HELP },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_tests",
      description: "Run the project's Vitest tests and return a short summary.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
];

// The model writes these arguments, so nothing about them can be trusted.
function parseArgs(rawArgs: string): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = rawArgs.trim() === "" ? {} : JSON.parse(rawArgs);
  } catch {
    throw new ToolError("The tool arguments were not valid JSON.");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ToolError("The tool arguments must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

function optionalString(
  args: Record<string, unknown>,
  name: string,
): string | undefined {
  const value = args[name];

  if (value !== undefined && typeof value !== "string") {
    throw new ToolError(`The "${name}" argument must be a string.`);
  }

  return value;
}

function requiredString(args: Record<string, unknown>, name: string): string {
  const value = optionalString(args, name);

  if (value === undefined) {
    throw new ToolError(`The "${name}" argument is required.`);
  }

  return value;
}

// Never throws: a failed tool is handed back to the model like any other
// result, so the run carries on and the failure stays visible.
export async function executeTool(
  name: string,
  rawArgs: string,
  rootDir: string,
): Promise<ToolResult> {
  try {
    const args = parseArgs(rawArgs);

    switch (name) {
      case "list_files":
        return await listFiles(rootDir, optionalString(args, "path"));
      case "read_file":
        return await readFile(rootDir, requiredString(args, "path"));
      case "search_code":
        return await searchCode(
          rootDir,
          requiredString(args, "query"),
          optionalString(args, "path"),
        );
      case "run_tests":
        return await runTests(rootDir);
      default:
        throw new ToolError(`Unknown tool: ${name}`);
    }
  } catch (error) {
    // Other errors can contain real folder paths, so their text stays out.
    const message =
      error instanceof ToolError
        ? error.message
        : "The tool failed unexpectedly.";

    return { ok: false, summary: message, output: `Error: ${message}` };
  }
}
