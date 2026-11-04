import type { Run } from "../recorder/types";

// How a run ended, as the UI groups it: a green tick, a red cross, or a clock
// for a run that's still going.
export type RunState = "answered" | "stopped" | "running";

const STATUS_LABELS: Record<Run["status"], string> = {
  answered: "Answered",
  running: "Running",
  max_rounds: "Stopped: round limit",
  cut_off: "Stopped: output cut off",
  model_error: "Stopped: model error",
};

export function runState(status: Run["status"]): RunState {
  if (status === "answered" || status === "running") return status;
  return "stopped";
}

export function statusLabel(status: Run["status"]): string {
  return STATUS_LABELS[status];
}

// How long ago something happened: "just now", "2m", "1h", "3d".
export function timeAgo(iso: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.floor(hours / 24)}d`;
}

// Whether a time falls on the same calendar day as `now`, in the server's
// time zone.
export function isSameDay(iso: string, now: number): boolean {
  return new Date(iso).toDateString() === new Date(now).toDateString();
}

// "1.4k tok", short enough for a waterfall row.
export function shortTokens(tokens: number | null): string | null {
  if (tokens === null) return null;
  return tokens < 1000 ? `${tokens} tok` : `${(tokens / 1000).toFixed(1)}k tok`;
}

// "3,512 tokens", for the run header.
export function fullTokens(tokens: number): string {
  return `${tokens.toLocaleString("en-US")} ${tokens === 1 ? "token" : "tokens"}`;
}
