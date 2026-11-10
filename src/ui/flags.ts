import type { Flag, FlagKind } from "../flags/types";
import type { Step } from "../recorder/types";

// The pill in the run header.
const TITLES: Record<FlagKind, string> = {
  tool_failed: "Tool call failed",
  unknown_tool: "Unknown tool",
  round_limit: "Round limit",
  repeated_call: "Repeated call",
  slow_step: "Slow step",
};

// The word after a step's name in the timeline. The round limit is about the
// whole run, so it has no row to go on.
const TAGS: Record<FlagKind, string | null> = {
  tool_failed: "error",
  unknown_tool: "unknown tool",
  round_limit: null,
  repeated_call: "repeated",
  slow_step: "slow",
};

// The flags that say why a run stopped. When one of them is there, the error
// it's about (the run's, or the failed step's) says the same thing as the flag.
const STOPS_THE_RUN: FlagKind[] = ["round_limit", "unknown_tool"];

export interface Tag {
  text: string;
  severity: Flag["severity"];
}

// "Unknown tool · write_file", or just "Round limit".
export function flagTitle(flag: Flag): string {
  return flag.tool ? `${TITLES[flag.kind]} · ${flag.tool}` : TITLES[flag.kind];
}

// Whether one of these flags already explains the error, so showing the
// error's own sentence too would only repeat it. A failed tool's flag doesn't
// count: it says the tool failed, and only the error says why.
export function explainsError(flags: Flag[]): boolean {
  return flags.some((flag) => STOPS_THE_RUN.includes(flag.kind));
}

// What goes after a step's name, errors first. A failed step that no flag
// explains still says "error", as it did before flags.
export function stepTags(step: Step, flags: Flag[]): Tag[] {
  const tags = flags.flatMap((flag): Tag[] => {
    const text = TAGS[flag.kind];
    return flag.stepId === step.id && text !== null ? [{ text, severity: flag.severity }] : [];
  });

  if (!step.ok && !tags.some((tag) => tag.severity === "error")) {
    tags.push({ text: "error", severity: "error" });
  }
  return tags.sort((a, b) => Number(a.severity === "warning") - Number(b.severity === "warning"));
}
