import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { executeTool } from "./index";
import { buildTestEnv, runTests } from "./run-tests";

const SECRET = "TOP-SECRET";

let sandbox: string;
let root: string;

// sandbox/
//   secret.txt             outside the project
//   project-evil/          outside, but its name starts like the project's
//   outside/               outside, and project/link-out points at it
//   project/               the only folder the tools may touch
beforeAll(async () => {
  sandbox = await realpath(await mkdtemp(path.join(tmpdir(), "agent-tools-")));
  root = path.join(sandbox, "project");

  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "node_modules", "pkg"), { recursive: true });
  await mkdir(path.join(root, ".hidden"));
  await mkdir(path.join(sandbox, "project-evil"));
  await mkdir(path.join(sandbox, "outside"));

  await writeFile(path.join(root, "src", "cart.ts"), "export const cart = 1;\n");
  await writeFile(path.join(root, "..foo.txt"), "odd but valid name\n");
  await writeFile(path.join(root, "big.txt"), "x".repeat(30_000));
  await writeFile(path.join(root, "node_modules", "pkg", "dep.ts"), "cart\n");
  await writeFile(path.join(root, ".hidden", "note.ts"), "cart\n");
  await writeFile(path.join(sandbox, "secret.txt"), SECRET);
  await writeFile(path.join(sandbox, "project-evil", "secret.txt"), SECRET);
  await writeFile(path.join(sandbox, "outside", "secret.txt"), SECRET);

  // A junction is a folder link that works on Windows without admin rights.
  // Everywhere else this creates a normal symlink.
  await symlink(path.join(sandbox, "outside"), path.join(root, "link-out"), "junction");
});

afterAll(async () => {
  await rm(sandbox, { recursive: true, force: true });
});

// Each tool, called with one path. search_code looks for text that is in the
// secret files, so a leak would show up in its output.
const PATH_TOOLS = [
  { tool: "read_file", args: (p: string) => ({ path: p }) },
  { tool: "list_files", args: (p: string) => ({ path: p }) },
  { tool: "search_code", args: (p: string) => ({ query: SECRET, path: p }) },
];

const ESCAPES: [string, () => string][] = [
  ["parent folder", () => ".."],
  ["parent file", () => "../secret.txt"],
  ["parent file with backslashes", () => "..\\secret.txt"],
  ["climbing out of a subfolder", () => "src/../../secret.txt"],
  ["sibling folder with a similar name", () => "../project-evil/secret.txt"],
  ["absolute path outside", () => path.join(sandbox, "secret.txt")],
  ["absolute path inside", () => path.join(root, "src", "cart.ts")],
  ["unix absolute path", () => "/etc/passwd"],
  ["windows absolute path", () => "C:\\Windows\\win.ini"],
  ["windows drive-relative path", () => "C:secret.txt"],
  ["windows network path", () => "\\\\server\\share\\secret.txt"],
  ["hidden file stream", () => "src/cart.ts::$DATA"],
  ["null byte", () => "src/cart.ts\0.txt"],
  ["folder link pointing outside", () => "link-out"],
  ["file through a folder link", () => "link-out/secret.txt"],
];

describe.each(PATH_TOOLS)("$tool path safety", ({ tool, args }) => {
  it.each(ESCAPES)("refuses %s", async (_name, getPath) => {
    const result = await executeTool(tool, JSON.stringify(args(getPath())), root);

    expect(result.ok).toBe(false);
    expect(result.output).toContain("Path not allowed");
    expect(result.output).not.toContain(SECRET);
    expect(result.output).not.toContain(sandbox);
  });
});

describe("paths that are allowed", () => {
  it.each(["src/cart.ts", "./src/cart.ts", "src\\cart.ts", "src/../src/cart.ts"])(
    "reads %s",
    async (filePath) => {
      const result = await executeTool(
        "read_file",
        JSON.stringify({ path: filePath }),
        root,
      );

      expect(result.ok).toBe(true);
      expect(result.output).toContain("export const cart");
    },
  );

  it("doesn't mistake a name starting with two dots for an escape", async () => {
    const result = await executeTool("read_file", '{"path":"..foo.txt"}', root);

    expect(result.ok).toBe(true);
    expect(result.output).toContain("odd but valid name");
  });

  it("lists the project root by default", async () => {
    const result = await executeTool("list_files", "{}", root);

    expect(result.ok).toBe(true);
    expect(result.output).toContain("src/cart.ts");
  });
});

describe("walking folders", () => {
  it("list_files skips links, node_modules and dot-folders", async () => {
    const { output } = await executeTool("list_files", "{}", root);

    expect(output).not.toContain("secret.txt");
    expect(output).not.toContain("node_modules");
    expect(output).not.toContain(".hidden");
  });

  it("search_code doesn't follow a link out of the project", async () => {
    const result = await executeTool(
      "search_code",
      JSON.stringify({ query: SECRET }),
      root,
    );

    expect(result.ok).toBe(true);
    expect(result.summary).toBe("no matches");
  });

  it("search_code skips node_modules and dot-folders", async () => {
    const { output } = await executeTool("search_code", '{"query":"cart"}', root);

    expect(output).toContain("src/cart.ts:1:");
    expect(output).not.toContain("dep.ts");
    expect(output).not.toContain("note.ts");
  });

  it("search_code treats the query as plain text, not a pattern", async () => {
    const result = await executeTool("search_code", '{"query":"c.rt"}', root);

    expect(result.summary).toBe("no matches");
  });
});

describe("other bad input", () => {
  it("reports a missing file without showing the real folder", async () => {
    const result = await executeTool("read_file", '{"path":"nope.ts"}', root);

    expect(result.ok).toBe(false);
    expect(result.output).toContain("No such file");
    expect(result.output).not.toContain(sandbox);
  });

  it("refuses a Windows device name", async () => {
    const result = await executeTool("read_file", '{"path":"NUL"}', root);

    expect(result.ok).toBe(false);
  });

  it("refuses to read a folder", async () => {
    const result = await executeTool("read_file", '{"path":"src"}', root);

    expect(result.ok).toBe(false);
  });

  it.each(["not json", "[]", "null", '{"path":5}'])(
    "survives bad arguments: %s",
    async (rawArgs) => {
      const result = await executeTool("read_file", rawArgs, root);

      expect(result.ok).toBe(false);
    },
  );

  it("reports an unknown tool", async () => {
    const result = await executeTool("delete_everything", "{}", root);

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("Unknown tool");
  });

  it("cuts off a very large file", async () => {
    const result = await executeTool("read_file", '{"path":"big.txt"}', root);

    expect(result.ok).toBe(true);
    expect(result.summary).toContain("cut off");
    expect(result.output.length).toBeLessThan(21_000);
  });
});

describe("run_tests", () => {
  it("stops and says so when it hits the timeout", async () => {
    const result = await runTests(path.join(process.cwd(), "sample-project"), 1);

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("timed out");
  });

  it("keeps the API key out of the test process", () => {
    const env = buildTestEnv({ GROQ_API_KEY: "secret", PATH: "/bin" });

    expect(env.GROQ_API_KEY).toBeUndefined();
    expect(env.PATH).toBe("/bin");
  });
});
