import { formatDuration } from "../lib/format";
import { depthOf } from "../recorder/tree";
import type { Run, Step } from "../recorder/types";
import { readToolUseFailure, wholeStepError } from "./errors";


const MIN_BAR_PERCENT = 0.6;

const GRID_STEPS_MS = [10, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 30_000, 60_000, 120_000, 300_000];
const MAX_GRID_LINES = 5;

const LAST_LABEL_PERCENT = 85;
const MAX_NOTE_LENGTH = 240;

export interface Bar {
  leftPercent: number;
  widthPercent: number;
}

export interface TimeAxis {
  ticks: { percent: number; label: string }[];
  gridPercent: number;
  endLabel: string;
}

export interface WaterfallRow {
  step: Step;
  number: number; 
  depth: number;
  label: string;
  detail: string | null;
  bar: Bar;
}

export function barFor(startMs: number, durationMs: number, totalMs: number): Bar {
  if (totalMs <= 0) return { leftPercent: 0, widthPercent: MIN_BAR_PERCENT };

  const widthPercent = Math.min(100, Math.max((durationMs / totalMs) * 100, MIN_BAR_PERCENT));
  const leftPercent = Math.min(Math.max((startMs / totalMs) * 100, 0), 100 - widthPercent);
  return { leftPercent, widthPercent };
}

function tickLabel(ms: number): string {
  if (ms === 0) return "0s";
  return ms < 1_000 ? `${ms}ms` : `${ms / 1_000}s`;
}


export function timeAxis(totalMs: number): TimeAxis {
  if (totalMs <= 0) return { ticks: [{ percent: 0, label: "0s" }], gridPercent: 100, endLabel: "0ms" };

  const stepMs =
    GRID_STEPS_MS.find((step) => totalMs / step <= MAX_GRID_LINES) ?? GRID_STEPS_MS[GRID_STEPS_MS.length - 1];
  const ticks: TimeAxis["ticks"] = [];

  for (let ms = 0; ms < totalMs; ms += stepMs) {
    const percent = (ms / totalMs) * 100;
    if (ms > 0 && percent > LAST_LABEL_PERCENT) break;
    ticks.push({ percent, label: tickLabel(ms) });
  }

  return { ticks, gridPercent: (stepMs / totalMs) * 100, endLabel: formatDuration(totalMs) };
}


export function stepLabel(step: Step, steps: Step[]): string {
  switch (step.type) {
    case "model":
      if (!step.ok) return "Model call";
      return steps.some((other) => other.parentId === step.id) ? "Plan next step" : "Decide";
    case "tool":
      return step.name;
    case "answer":
      return "Answer";
  }
}


export function toolDetail(input: string | null): string | null {
  if (!input) return null;

  try {
    const args: unknown = JSON.parse(input);
    if (typeof args !== "object" || args === null) return null;
    const { query, path } = args as { query?: unknown; path?: unknown };
    if (typeof query === "string") return JSON.stringify(query);
    if (typeof path === "string") return path;
    return null;
  } catch {
   
    return input.length > 40 ? `${input.slice(0, 37)}...` : input;
  }
}

export function stepKind(step: Step): string {
  return step.type === "model" ? "model call" : step.type === "tool" ? "tool call" : "answer";
}

function shorten(text: string | null): string | null {
  if (text === null || text.trim() === "") return null;
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= MAX_NOTE_LENGTH ? oneLine : `${oneLine.slice(0, MAX_NOTE_LENGTH - 3)}...`;
}


export function stepNote(step: Step, steps: Step[], runError: string | null): { label: string; text: string | null } {
  if (!step.ok) {
    const error = wholeStepError(step.error, runError);
    const failure = error === null ? null : readToolUseFailure(error);
    return {
      label: step.type === "tool" ? "The tool returned an error" : "The model call failed",
      text: shorten(failure?.summary ?? error),
    };
  }

  switch (step.type) {
    case "model": {
      const tools = steps.filter((other) => other.parentId === step.id).length;
      return {
        label: tools > 0 ? `Model asked for ${tools} ${tools === 1 ? "tool" : "tools"}` : "Model replied with no tool call",
        text: shorten(step.output),
      };
    }
    case "tool":
      return { label: "The tool returned", text: shorten(step.output) };
    case "answer":
      return { label: "Final answer", text: shorten(step.output) };
  }
}

export function buildRows(run: Run, totalMs: number): WaterfallRow[] {
  const stepsById = new Map(run.steps.map((step) => [step.id, step]));

  return run.steps.map((step, index) => ({
    step,
    number: index + 1,
    depth: depthOf(step, stepsById),
    label: stepLabel(step, run.steps),
    detail: step.type === "tool" ? toolDetail(step.input) : null,
    bar: barFor(step.startMs, step.durationMs, totalMs),
  }));
}
