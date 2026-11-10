export type FlagKind = "tool_failed" | "unknown_tool" | "round_limit" | "repeated_call" | "slow_step";

// A problem the debugger spotted in a run on its own.
export interface Flag {
  kind: FlagKind;
  // "error": something broke. "warning": worth a look, but nothing broke.
  severity: "error" | "warning";
  stepId: string | null; // the step it points at; null means the whole run
  tool: string | null; // the tool it's about, if there is one
  message: string; // one plain sentence, with tool names in `backticks`
}
