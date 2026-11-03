import type { AgentStep } from "../agent/run-agent";
import type { Run, Step } from "./types";

const MAX_STORED_CHARS = 2_000;
const HIDDEN = "[hidden key]";
// Every Groq key starts with gsk_.
const GROQ_KEY_PATTERN = /gsk_[A-Za-z0-9]+/g;
// A very short "secret" would hide ordinary words, so those are ignored.
const MIN_SECRET_LENGTH = 8;

interface RecorderOptions {
  id: string;
  model: string;
  promptVersion: string;
  secrets?: (string | undefined)[];
  now?: () => number;
}

export interface Recorder {
  onStep: (step: AgentStep) => void;
  getRun: () => Run;
}

export function hideSecrets(text: string, secrets: string[]): string {
  let hidden = text;

  for (const secret of secrets) {
    hidden = hidden.replaceAll(secret, HIDDEN);
  }

  return hidden.replace(GROQ_KEY_PATTERN, HIDDEN);
}

export function trimText(text: string): string {
  if (text.length <= MAX_STORED_CHARS) return text;
  return `${text.slice(0, MAX_STORED_CHARS)}\n[trimmed: ${text.length - MAX_STORED_CHARS} more characters]`;
}

// Listens to the same step events the terminal prints, and builds one Run
// record from them. It never changes what the agent does.
export function createRecorder({
  id,
  model,
  promptVersion,
  secrets = [],
  now = () => performance.now(),
}: RecorderOptions): Recorder {
  const realSecrets = secrets.filter(
    (secret): secret is string =>
      secret !== undefined && secret.length >= MIN_SECRET_LENGTH,
  );
  const run: Run = {
    id,
    question: "",
    model,
    promptVersion,
    startedAt: new Date().toISOString(),
    status: "running",
    answer: null,
    error: null,
    steps: [],
  };
  let runStartedAt = now();
  let currentModelCall: Step | null = null;
  let modelCallOpen = false;
  let currentTool: Step | null = null;
  let toolsSinceModelCall: string[] = [];

  // Real Groq replies can leave a field out completely (undefined) instead of
  // sending null, like content on a reply that only calls tools. Anything
  // missing is stored as null.
  const hide = (text: string | null | undefined) =>
    text === null || text === undefined ? null : hideSecrets(text, realSecrets);
  // Hidden first, then trimmed, so a key cut in half by the trim can't survive.
  const clean = (text: string | null | undefined) => {
    const hidden = hide(text);
    return hidden === null ? null : trimText(hidden);
  };

  // The events carry no clock time, but the loop sends each one the moment it
  // happens, so the time it arrives here is when the step started.
  const elapsed = () => Math.round(now() - runStartedAt);

  function addStep(
    fields: Pick<Step, "parentId" | "type" | "name" | "round" | "input">,
  ): Step {
    const step: Step = {
      id: `s${run.steps.length + 1}`,
      parentId: fields.parentId,
      type: fields.type,
      name: fields.name,
      round: fields.round,
      startMs: elapsed(),
      durationMs: 0,
      tokens: null,
      input: fields.input,
      output: null,
      reasoning: null,
      ok: true,
      error: null,
    };
    run.steps.push(step);
    return step;
  }

  function onStep(step: AgentStep): void {
    switch (step.type) {
      case "run_start":
        runStartedAt = now();
        run.startedAt = new Date().toISOString();
        run.question = hide(step.question) ?? "";
        break;
      case "model_call_start":
        // The model sees the whole conversation, which earlier steps already
        // hold, so only what's new to it is stored as its input.
        currentModelCall = addStep({
          parentId: null,
          type: "model",
          name: "model call",
          round: step.round,
          input: clean(
            step.round === 1
              ? run.question
              : `results of ${toolsSinceModelCall.join(", ")}`,
          ),
        });
        modelCallOpen = true;
        toolsSinceModelCall = [];
        break;
      case "model_call_end":
        if (!currentModelCall) break;
        modelCallOpen = false;
        currentModelCall.durationMs = Math.round(step.durationMs);
        currentModelCall.tokens = step.totalTokens ?? null;
        currentModelCall.output = clean(step.content);
        currentModelCall.reasoning = clean(step.reasoning);
        break;
      case "tool_call_start":
        // Tools run one at a time, so the next tool_call_end belongs to this one.
        currentTool = addStep({
          parentId: currentModelCall?.id ?? null,
          type: "tool",
          name: hide(step.name) ?? "",
          round: step.round,
          input: clean(step.args),
        });
        toolsSinceModelCall.push(currentTool.name);
        break;
      case "tool_call_end":
        if (!currentTool) break;
        currentTool.durationMs = Math.round(step.durationMs);
        currentTool.ok = step.ok;
        currentTool.output = clean(step.output);
        currentTool.error = step.ok ? null : clean(step.summary);
        currentTool = null;
        break;
      case "run_end":
        run.status = step.status;
        run.answer = hide(step.answer);
        run.error = hide(step.error);

        // These two endings are the last model call's fault. A round limit
        // isn't any one step's fault, so only the run shows it.
        if (
          currentModelCall &&
          (step.status === "cut_off" || step.status === "model_error")
        ) {
          // A model call that threw never sent model_call_end, so it's timed here.
          if (modelCallOpen) {
            currentModelCall.durationMs = elapsed() - currentModelCall.startMs;
          }
          currentModelCall.ok = false;
          currentModelCall.error = clean(step.error);
        }

        if (step.status === "answered") {
          const answer = addStep({
            parentId: null,
            type: "answer",
            name: "answer",
            round: step.rounds,
            input: null,
          });
          answer.output = clean(step.answer);
        }
        break;
    }
  }

  return { onStep, getRun: () => run };
}
