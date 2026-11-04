import { countLabel, formatDuration, formatTokens } from "../lib/format";
import type { RunTotals } from "./totals";
import { depthOf } from "./tree";
import type { Run, Step } from "./types";

const MAX_QUESTION_SHOWN = 60;
const MAX_ARGS_SHOWN = 80;
const MAX_ERROR_SHOWN = 120;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// Local time, like 2026-11-03 14:05:09.
function formatDateTime(iso: string, withSeconds: boolean): string {
  const date = new Date(iso);
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return withSeconds ? `${day} ${time}:${pad(date.getSeconds())}` : `${day} ${time}`;
}

function shorten(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 3)}...`;
}

export function formatRunList(runs: Run[]): string {
  if (runs.length === 0) {
    return 'No saved runs yet. Try: npm run agent -- "your question"';
  }

  const stepLabels = runs.map((run) => countLabel(run.steps.length, "step"));
  const statusWidth = Math.max(...runs.map((run) => run.status.length));
  const stepsWidth = Math.max(...stepLabels.map((label) => label.length));

  return runs
    .map((run, index) =>
      [
        run.id,
        formatDateTime(run.startedAt, false),
        run.status.padEnd(statusWidth),
        stepLabels[index].padStart(stepsWidth),
        JSON.stringify(shorten(run.question, MAX_QUESTION_SHOWN)),
      ].join("  "),
    )
    .join("\n");
}

function describeStep(step: Step): string {
  switch (step.type) {
    case "model":
      return `model call (round ${step.round}, ${formatTokens(step.tokens)})`;
    case "tool":
      return `${step.name} ${shorten(step.input ?? "", MAX_ARGS_SHOWN)}`;
    case "answer":
      return "answer";
  }
}

export function formatRunTree(run: Run): string {
  const stepsById = new Map(run.steps.map((step) => [step.id, step]));
  const lines = [
    `${run.id}  ${run.status}`,
    `question  ${JSON.stringify(run.question)}`,
    `model     ${run.model}, prompt ${run.promptVersion}`,
    `started   ${formatDateTime(run.startedAt, true)}`,
    "",
    `${"start".padStart(7)}  ${"took".padStart(6)}`,
  ];

  for (const step of run.steps) {
    const took = step.type === "answer" ? "-" : formatDuration(step.durationMs);
    const indent = "  ".repeat(depthOf(step, stepsById));
    const error = step.ok
      ? ""
      : `  ERROR: ${shorten(step.error ?? "failed", MAX_ERROR_SHOWN)}`;

    lines.push(
      `${formatDuration(step.startMs).padStart(7)}  ${took.padStart(6)}  ${indent}${describeStep(step)}${error}`,
    );
  }

  lines.push("");

  if (run.answer !== null) {
    lines.push("ANSWER", run.answer);
  } else {
    lines.push(`STOPPED (${run.status})`, run.error ?? "");
  }

  return lines.join("\n");
}

export function formatTotals(totals: RunTotals): string {
  return `totals: ${formatDuration(totals.durationMs)}, ${formatTokens(totals.tokens)}, ${countLabel(totals.modelCalls, "model call")}, ${countLabel(totals.toolCalls, "tool call")}, ${totals.failedToolCalls} failed`;
}
