import { z } from "zod";
import { RUN_ID_PATTERN } from "../recorder/run-id";
import type { Run } from "../recorder/types";

// Limits for what the server accepts. The recorder trims step text to 2,000
// characters plus a short note, so these leave plenty of room.
const MAX_STEPS = 200;
const MAX_STEP_TEXT = 5_000;
const MAX_LONG_TEXT = 100_000; // the question, answer and error are kept whole
const MAX_NAME = 200;
const MAX_PROBLEMS_SHOWN = 10;

const stepText = z.string().max(MAX_STEP_TEXT).nullable();
const wholeMs = z.number().int().nonnegative();
const stepId = z.string().regex(/^s\d{1,4}$/, "must look like s1");

const stepSchema = z.object({
  id: stepId,
  parentId: stepId.nullable(),
  type: z.enum(["model", "tool", "answer"]),
  name: z.string().max(MAX_NAME),
  round: z.number().int().positive(),
  startMs: wholeMs,
  durationMs: wholeMs,
  tokens: wholeMs.nullable(),
  input: stepText,
  output: stepText,
  reasoning: stepText,
  ok: z.boolean(),
  error: stepText,
});

// The `z.ZodType<Run>` label makes TypeScript check that these rules produce
// a real Run, so the checks and the type can't drift apart.
export const runSchema: z.ZodType<Run> = z
  .object({
    id: z.string().regex(RUN_ID_PATTERN, "must look like run_8f2a91c3"),
    question: z.string().max(MAX_LONG_TEXT),
    model: z.string().min(1).max(MAX_NAME),
    promptVersion: z.string().min(1).max(MAX_NAME),
    startedAt: z.iso.datetime(),
    status: z.enum(["running", "answered", "max_rounds", "cut_off", "model_error"]),
    answer: z.string().max(MAX_LONG_TEXT).nullable(),
    error: z.string().max(MAX_LONG_TEXT).nullable(),
    steps: z.array(stepSchema).max(MAX_STEPS),
  })
  .superRefine((run, context) => {
    // Step ids must be unique, and a parent must come before its children.
    const earlierIds = new Set<string>();

    run.steps.forEach((step, index) => {
      if (earlierIds.has(step.id)) {
        context.addIssue({
          code: "custom",
          path: ["steps", index, "id"],
          message: `${step.id} is used by more than one step`,
        });
      }

      if (step.parentId !== null && !earlierIds.has(step.parentId)) {
        context.addIssue({
          code: "custom",
          path: ["steps", index, "parentId"],
          message: `${step.parentId} isn't an earlier step in this run`,
        });
      }

      earlierIds.add(step.id);
    });
  });

// Short, readable problems, like "steps.2.durationMs: Too small: expected
// number to be >=0".
export function describeProblems(error: z.ZodError): string[] {
  return error.issues
    .slice(0, MAX_PROBLEMS_SHOWN)
    .map((issue) => `${issue.path.join(".") || "run"}: ${issue.message}`);
}
