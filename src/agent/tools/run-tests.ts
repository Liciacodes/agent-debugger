import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ToolResult } from "./types";

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_FAILURES_SHOWN = 5;
const MAX_MESSAGE_LENGTH = 200;

// Only these reach the test process, so GROQ_API_KEY stays out of it.
const ALLOWED_ENV_VARS = [
  "PATH",
  "SystemRoot",
  "TEMP",
  "TMP",
  "TMPDIR",
  "HOME",
  "USERPROFILE",
];

interface VitestTest {
  fullName: string;
  status: string;
  failureMessages: string[];
}

interface VitestFile {
  name: string;
  status: string;
  message: string;
  assertionResults: VitestTest[];
}

interface VitestReport {
  numPassedTests: number;
  numFailedTests: number;
  testResults: VitestFile[];
}

export function buildTestEnv(
  baseEnv: Record<string, string | undefined> = process.env,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", CI: "1", NO_COLOR: "1" };

  for (const name of ALLOWED_ENV_VARS) {
    const value = baseEnv[name];
    if (value !== undefined) env[name] = value;
  }

  return env;
}

function killProcessTree(child: ChildProcess): void {
  // On Windows, killing the parent would leave Vitest's workers running.
  if (process.platform === "win32" && child.pid !== undefined) {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    child.kill("SIGKILL");
  }
}

// Runs Vitest directly with Node, not through a shell, so nothing gets
// reinterpreted as a command. Resolves on timeout without waiting for the
// process to finish closing.
function runVitest(
  rootDir: string,
  reportFile: string,
  timeoutMs: number,
): Promise<{ timedOut: boolean; exitCode: number | null }> {
  const vitestEntry = path.join(
    process.cwd(),
    "node_modules",
    "vitest",
    "vitest.mjs",
  );

  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [vitestEntry, "run", "--reporter=json", `--outputFile=${reportFile}`],
      {
        cwd: rootDir,
        env: buildTestEnv(),
        stdio: "ignore",
        windowsHide: true,
      },
    );

    const timer = setTimeout(() => {
      killProcessTree(child);
      resolve({ timedOut: true, exitCode: null });
    }, timeoutMs);

    child.on("error", () => {
      clearTimeout(timer);
      resolve({ timedOut: false, exitCode: null });
    });

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ timedOut: false, exitCode });
    });
  });
}

// Keeps one short line and swaps real folder paths for "." before anything
// reaches the model.
function shortMessage(message: string | undefined, rootDir: string): string {
  let firstLine = (message ?? "").trim().split(/\r?\n/)[0] ?? "";

  for (const folder of [rootDir, process.cwd()]) {
    firstLine = firstLine
      .replaceAll(folder, ".")
      .replaceAll(folder.replaceAll("\\", "/"), ".");
  }

  return firstLine.slice(0, MAX_MESSAGE_LENGTH);
}

function couldNotRun(reason: string): ToolResult {
  const summary = `tests could not run: ${reason}`;
  return { ok: false, summary, output: `Error: ${summary}` };
}

function summarize(report: VitestReport, rootDir: string): ToolResult {
  const failures: string[] = [];
  let brokenFiles = 0;

  for (const file of report.testResults) {
    const fileName = path.relative(rootDir, file.name).replaceAll(path.sep, "/");
    const failedTests = file.assertionResults.filter(
      (test) => test.status === "failed",
    );

    // A file that fails to load has no test results, only its own message.
    if (file.status === "failed" && failedTests.length === 0) {
      brokenFiles += 1;
      failures.push(
        `FAILED TO LOAD ${fileName}\n  ${shortMessage(file.message, rootDir)}`,
      );
    }

    for (const test of failedTests) {
      failures.push(
        `FAILED ${fileName} > ${test.fullName}\n  ${shortMessage(test.failureMessages[0], rootDir)}`,
      );
    }
  }

  const counts = [
    `${report.numPassedTests} passed`,
    `${report.numFailedTests} failed`,
    ...(brokenFiles > 0 ? [`${brokenFiles} failed to load`] : []),
  ].join(", ");
  const shown = failures.slice(0, MAX_FAILURES_SHOWN);
  const hiddenCount = failures.length - shown.length;

  return {
    ok: true,
    summary: counts,
    output: [
      counts,
      ...shown,
      ...(hiddenCount > 0 ? [`...and ${hiddenCount} more`] : []),
    ].join("\n\n"),
  };
}

export async function runTests(
  rootDir: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ToolResult> {
  const reportDir = await mkdtemp(path.join(tmpdir(), "agent-run-tests-"));
  const reportFile = path.join(reportDir, "report.json");

  try {
    const { timedOut, exitCode } = await runVitest(
      rootDir,
      reportFile,
      timeoutMs,
    );

    if (timedOut) {
      return couldNotRun(`timed out after ${timeoutMs / 1000}s`);
    }

    // Vitest exits with an error code when tests fail, which is a normal
    // result. Having no report at all is what means it could not run.
    let report: VitestReport;
    try {
      report = JSON.parse(await readFile(reportFile, "utf8"));
    } catch {
      return couldNotRun(`Vitest exited with code ${exitCode} and no results`);
    }

    return summarize(report, rootDir);
  } finally {
    await rm(reportDir, { recursive: true, force: true }).catch(() => {});
  }
}
