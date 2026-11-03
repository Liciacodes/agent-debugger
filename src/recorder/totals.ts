import type { Run } from "./types";

export interface RunTotals {
  durationMs: number;
  tokens: number;
  modelCalls: number;
  toolCalls: number;
  failedToolCalls: number;
}

export function computeTotals(run: Run): RunTotals {
 const steps = run.steps;

 const modelCalls = steps.filter((step) => step.type === "model").length;
 const toolCalls = steps.filter((step) => step.type === "tool").length;
 const failedToolCalls = steps.filter((step) => step.type === "tool" && step.ok === false).length;

 const durationMs = steps.length > 0 ? Math.max(...steps.map((step) => step.startMs + step.durationMs)) : 0;
 const tokens = steps.reduce((acc, step) => acc + (step.tokens || 0), 0);

 return {
   durationMs,
   tokens,
   modelCalls,
   toolCalls,
   failedToolCalls,
 };
}
