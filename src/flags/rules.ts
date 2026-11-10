import { formatDuration } from "../lib/format";
import { computeTotals } from "../recorder/totals";
import type { Run } from "../recorder/types";
import { readToolUseFailure, wholeStepError } from "../ui/errors";
import type { Flag } from "./types";

// A step is slow when it alone took more than this share of the run...
const SLOW_SHARE = 0.5;
// ...and at least this long. In a quick run the first model call is always the
// biggest piece (53% of the 1.9s run_ce2adda3), and that isn't worth a flag.
const SLOW_MIN_MS = 2_000;

// Every tool call that returned an error instead of a result.
export function failedToolCalls(run: Run): Flag[] {
  return run.steps
    .filter((step) => step.type === "tool" && !step.ok)
    .map(
      (step): Flag => ({
        kind: "tool_failed",
        severity: "error",
        stepId: step.id,
        tool: step.name,
        message: `\`${step.name}\` returned an error instead of a result.`,
      }),
    );
}

// A model call Groq turned down because it named a tool the model wasn't
// given. Our agent can't go on after that, so the run stops there.
export function unknownToolCalls(run: Run): Flag[] {
  return run.steps.flatMap((step): Flag[] => {
    if (step.type !== "model" || step.ok) return [];

    const error = wholeStepError(step.error, run.error);
    const failure = error === null ? null : readToolUseFailure(error);
    if (failure?.reason !== "unknown_tool") return [];

    return [
      {
        kind: "unknown_tool",
        severity: "error",
        stepId: step.id,
        tool: failure.tool,
        message: `The model asked for \`${failure.tool}\`, which isn't one of its tools, so Groq refused the request and the run stopped.`,
      },
    ];
  });
}

// The whole run's fault, not one step's, so it points at the run.
export function roundLimit(run: Run): Flag[] {
  if (run.status !== "max_rounds") return [];

  const rounds = Math.max(0, ...run.steps.map((step) => step.round));
  return [
    {
      kind: "round_limit",
      severity: "error",
      stepId: null,
      tool: null,
      message: `The model kept calling tools for all ${rounds} rounds and never gave an answer.`,
    },
  ];
}

// The one step, if any, that took most of the run's time.
export function slowSteps(run: Run): Flag[] {
  const { durationMs: totalMs } = computeTotals(run);

  return run.steps
    .filter((step) => step.durationMs >= SLOW_MIN_MS && step.durationMs > totalMs * SLOW_SHARE)
    .map(
      (step): Flag => ({
        kind: "slow_step",
        severity: "warning",
        stepId: step.id,
        tool: step.type === "tool" ? step.name : null,
        message: `This step took ${Math.round((step.durationMs / totalMs) * 100)}% of the run: ${formatDuration(step.durationMs)} of ${formatDuration(totalMs)}.`,
      }),
    );
}
