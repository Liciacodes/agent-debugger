import { RECORDER_TOKEN_HEADER } from "../server/recorder-token";
import type { Run } from "./types";

export const DEFAULT_RECORDER_URL = "http://localhost:3000";

const SEND_TIMEOUT_MS = 30_000;

export type SendResult =
  | { outcome: "stored" }
  | { outcome: "already_stored" }
  // unreachable: the server didn't answer at all, so trying more runs is pointless
  | { outcome: "failed"; reason: string; unreachable: boolean };

interface SendOptions {
  url: string;
  token: string | undefined;
  fetchFn?: typeof fetch;
}

export interface ImportTally {
  stored: number;
  alreadyStored: number;
  failed: { id: string; reason: string }[];
  // Runs not tried, because the server stopped answering.
  notTried: number;
}

async function readServerError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return [body.error, body.problems?.[0]].filter(Boolean).join(" ");
  } catch {
    return "";
  }
}

// Sends one finished run to POST /api/runs. Never throws: every problem comes
// back as a reason, so a failed send can't lose the run, which is already saved
// in runs/.
export async function sendRun(
  run: Run,
  { url, token, fetchFn = fetch }: SendOptions,
): Promise<SendResult> {
  if (!token) {
    return { outcome: "failed", reason: "RECORDER_TOKEN isn't set in .env.local", unreachable: false };
  }

  let response: Response;

  try {
    response = await fetchFn(new URL("/api/runs", url), {
      method: "POST",
      headers: { "content-type": "application/json", [RECORDER_TOKEN_HEADER]: token },
      body: JSON.stringify(run),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      outcome: "failed",
      reason: timedOut
        ? `the server at ${url} didn't answer in time`
        : `the server at ${url} isn't reachable (is npm run dev running?)`,
      unreachable: true,
    };
  }

  if (response.status === 201) return { outcome: "stored" };
  if (response.status === 200) return { outcome: "already_stored" };

  const message = await readServerError(response);
  return {
    outcome: "failed",
    reason: `the server answered ${response.status}${message ? `: ${message}` : ""}`,
    unreachable: false,
  };
}

export function describeSendResult(result: SendResult, url: string): string {
  switch (result.outcome) {
    case "stored":
      return `sent to ${url}`;
    case "already_stored":
      return `already stored on ${url}`;
    case "failed":
      // The server's own messages already end with a full stop.
      return `not sent: ${result.reason.replace(/\.$/, "")}. It's saved in runs/, so npm run import can send it later.`;
  }
}

// Sends runs one at a time and counts what happened. Stops early if the
// server stops answering, instead of failing every remaining run the same way.
export async function importRuns(
  runs: Run[],
  send: (run: Run) => Promise<SendResult>,
): Promise<ImportTally> {
  const tally: ImportTally = { stored: 0, alreadyStored: 0, failed: [], notTried: 0 };

  for (const [index, run] of runs.entries()) {
    const result = await send(run);

    if (result.outcome === "stored") {
      tally.stored += 1;
    } else if (result.outcome === "already_stored") {
      tally.alreadyStored += 1;
    } else {
      tally.failed.push({ id: run.id, reason: result.reason });

      if (result.unreachable) {
        tally.notTried = runs.length - index - 1;
        break;
      }
    }
  }

  return tally;
}
