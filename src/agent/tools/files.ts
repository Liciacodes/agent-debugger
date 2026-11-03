import { open, readdir, readFile as readFileFromDisk, stat } from "node:fs/promises";
import path from "node:path";
import { resolveSafePath } from "./safe-path";
import { ToolError, type ToolResult } from "./types";

const MAX_LISTED_FILES = 200;
const MAX_READ_BYTES = 20_000;
const MAX_SEARCH_MATCHES = 50;
const MAX_SEARCH_FILE_BYTES = 1_000_000;
const MAX_MATCH_LINE_LENGTH = 200;

function toProjectPath(root: string, file: string): string {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function countLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

// Yields real files only. A link counts as neither a file nor a folder here,
// so links are never followed.
async function* walkFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isFile()) {
      yield fullPath;
    } else if (
      entry.isDirectory() &&
      entry.name !== "node_modules" &&
      !entry.name.startsWith(".")
    ) {
      yield* walkFiles(fullPath);
    }
  }
}

export async function listFiles(
  rootDir: string,
  folder = ".",
): Promise<ToolResult> {
  const { root, target } = await resolveSafePath(rootDir, folder);

  if (!(await stat(target)).isDirectory()) {
    throw new ToolError(`Not a folder: ${folder}`);
  }

  const files: string[] = [];
  let cutOff = false;

  for await (const file of walkFiles(target)) {
    if (files.length === MAX_LISTED_FILES) {
      cutOff = true;
      break;
    }
    files.push(toProjectPath(root, file));
  }

  const lines = files.length > 0 ? files.join("\n") : "(no files)";

  return {
    ok: true,
    summary: `${countLabel(files.length, "file")}${cutOff ? " (cut off)" : ""}`,
    output: cutOff ? `${lines}\n[cut off after ${MAX_LISTED_FILES} files]` : lines,
  };
}

export async function readFile(
  rootDir: string,
  filePath: string,
): Promise<ToolResult> {
  const { target } = await resolveSafePath(rootDir, filePath);
  const stats = await stat(target);

  // Also rejects Windows device names like NUL and CON.
  if (!stats.isFile()) {
    throw new ToolError(`Not a file: ${filePath}`);
  }

  const bytesToRead = Math.min(stats.size, MAX_READ_BYTES);
  const handle = await open(target);

  try {
    const { buffer } = await handle.read(
      Buffer.alloc(bytesToRead),
      0,
      bytesToRead,
      0,
    );
    const text = buffer.toString("utf8");

    if (stats.size > MAX_READ_BYTES) {
      return {
        ok: true,
        summary: `read ${bytesToRead} of ${stats.size} bytes (cut off)`,
        output: `${text}\n[cut off: file is ${stats.size} bytes, showing the first ${bytesToRead}]`,
      };
    }

    return { ok: true, summary: `read ${stats.size} bytes`, output: text };
  } finally {
    await handle.close();
  }
}

// Plain text matching on purpose: with no shell and no regex, a search can't
// run commands or hang on a nasty pattern.
export async function searchCode(
  rootDir: string,
  query: string,
  folder = ".",
): Promise<ToolResult> {
  if (query.trim() === "") {
    throw new ToolError("Search text cannot be empty.");
  }

  const { root, target } = await resolveSafePath(rootDir, folder);
  const files = (await stat(target)).isFile() ? [target] : walkFiles(target);
  const needle = query.toLowerCase();
  const matches: string[] = [];
  const matchedFiles = new Set<string>();
  let cutOff = false;

  for await (const file of files) {
    if (cutOff) break;
    if ((await stat(file)).size > MAX_SEARCH_FILE_BYTES) continue;

    const lines = (await readFileFromDisk(file, "utf8")).split(/\r?\n/);

    for (const [index, line] of lines.entries()) {
      if (!line.toLowerCase().includes(needle)) continue;

      if (matches.length === MAX_SEARCH_MATCHES) {
        cutOff = true;
        break;
      }

      const projectPath = toProjectPath(root, file);
      matchedFiles.add(projectPath);
      matches.push(
        `${projectPath}:${index + 1}: ${line.trim().slice(0, MAX_MATCH_LINE_LENGTH)}`,
      );
    }
  }

  if (matches.length === 0) {
    return { ok: true, summary: "no matches", output: "(no matches)" };
  }

  const lines = matches.join("\n");

  return {
    ok: true,
    summary: `${countLabel(matches.length, "match", "matches")} in ${countLabel(matchedFiles.size, "file")}${cutOff ? " (cut off)" : ""}`,
    output: cutOff ? `${lines}\n[cut off after ${MAX_SEARCH_MATCHES} matches]` : lines,
  };
}
