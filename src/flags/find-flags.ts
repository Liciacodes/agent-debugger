import type { Run } from "../recorder/types";
import { findRepeatedCalls } from "./repeated-calls";
import { failedToolCalls, roundLimit, slowSteps, unknownToolCalls } from "./rules";
import type { Flag } from "./types";

// Turns the ids from findRepeatedCalls into flags.
function repeatedCalls(run: Run): Flag[] {
  const repeats = new Set(findRepeatedCalls(run.steps));

  return run.steps
    .filter((step) => repeats.has(step.id))
    .map(
      (step): Flag => ({
        kind: "repeated_call",
        severity: "warning",
        stepId: step.id,
        tool: step.name,
        message: `\`${step.name}\` was already called with exactly these arguments earlier in the run.`,
      }),
    );
}

// Every problem the debugger spots in a run on its own. Whole-run ones come
// first, then the rest in step order, with errors before warnings.
export function findFlags(run: Run): Flag[] {
  const position = new Map(run.steps.map((step, index) => [step.id, index]));
  const placeOf = (flag: Flag) => (flag.stepId === null ? -1 : (position.get(flag.stepId) ?? -1));
  const flags = [
    ...roundLimit(run),
    ...unknownToolCalls(run),
    ...failedToolCalls(run),
    ...repeatedCalls(run),
    ...slowSteps(run),
  ];

  return flags.sort(
    (a, b) => placeOf(a) - placeOf(b) || Number(a.severity === "warning") - Number(b.severity === "warning"),
  );
}
