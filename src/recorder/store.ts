import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { RUN_ID_PATTERN } from "./run-id";
import type { Run } from "./types";

export const RUNS_DIR = path.join(process.cwd(), "runs");

export interface RunList {
  runs: Run[];
  unreadable: string[];
}

export function newRunId(): string {
  return `run_${randomBytes(4).toString("hex")}`;
}

function runFile(dir: string, id: string): string {
  if (!RUN_ID_PATTERN.test(id)) {
    throw new Error(`Not a run id: ${id}. Run ids look like run_8f2a91c3.`);
  }

  return path.join(dir, `${id}.json`);
}

function looksLikeRun(value: unknown): value is Run {
  const run = value as Run;

  return (
    typeof value === "object" &&
    value !== null &&
    typeof run.id === "string" &&
    typeof run.question === "string" &&
    typeof run.status === "string" &&
    typeof run.startedAt === "string" &&
    Array.isArray(run.steps)
  );
}

export async function saveRun(run: Run, dir = RUNS_DIR): Promise<void> {
  const file = runFile(dir, run.id);
  await mkdir(dir, { recursive: true });

  try {
    // "wx" refuses to write over a run that's already saved.
    await writeFile(file, `${JSON.stringify(run, null, 2)}\n`, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`A run with id ${run.id} is already saved.`);
    }
    throw error;
  }
}

export async function loadRun(id: string, dir = RUNS_DIR): Promise<Run> {
  const file = runFile(dir, id);
  let text: string;

  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`No saved run with id ${id}. See the saved runs with: npm run runs`);
    }
    throw error;
  }

  const run: unknown = JSON.parse(text);

  if (!looksLikeRun(run)) {
    throw new Error(`The file for ${id} isn't a saved run.`);
  }

  return run;
}

// Newest first. A file that can't be read is skipped and named, rather than
// breaking the whole list.
export async function listRuns(dir = RUNS_DIR): Promise<RunList> {
  let names: string[];

  try {
    names = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { runs: [], unreadable: [] };
    }
    throw error;
  }

  const runs: Run[] = [];
  const unreadable: string[] = [];

  for (const name of names.filter((name) => name.endsWith(".json"))) {
    try {
      runs.push(await loadRun(name.slice(0, -".json".length), dir));
    } catch {
      unreadable.push(name);
    }
  }

  // ISO times sort correctly as plain text.
  runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return { runs, unreadable };
}
