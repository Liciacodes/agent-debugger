import type { Step } from "./types";

// How many parents a step has: 0 for a model call or the answer, 1 for a tool
// under a model call. Used by `npm run show` and the waterfall. The limit stops
// a hand-edited file with a parent loop from hanging either of them.
export function depthOf(step: Step, stepsById: Map<string, Step>): number {
  let depth = 0;
  let parentId = step.parentId;

  while (parentId !== null && depth < 10) {
    depth += 1;
    parentId = stepsById.get(parentId)?.parentId ?? null;
  }

  return depth;
}
