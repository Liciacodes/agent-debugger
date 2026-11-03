import type { RunStatus } from "../agent/run-agent";

export type StepType = "model" | "tool" | "answer";

// One timed piece of work inside a run, like a span in a trace.
export interface Step {
  id: string; // "s1", "s2", ... in the order the steps started
  parentId: string | null; // null means the step sits directly under the run
  type: StepType;
  name: string; // "model call", the tool's name, or "answer"
  round: number;
  startMs: number; // how long after the run started this step began
  durationMs: number;
  tokens: number | null; // model calls only
  input: string | null; // trimmed
  output: string | null; // trimmed
  reasoning: string | null; // model calls only: the model's thinking, trimmed
  ok: boolean;
  error: string | null;
}

// One whole run, like a trace.
export interface Run {
  id: string;
  question: string;
  model: string;
  promptVersion: string;
  startedAt: string; // ISO date and time
  status: RunStatus | "running";
  answer: string | null;
  error: string | null;
  steps: Step[];
}
