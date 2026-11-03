// What every tool hands back. `output` goes to the model, `summary` is the
// short line people see. `ok` means the tool itself worked: run_tests is still
// ok when tests fail, and only not ok when they could not run at all.
export interface ToolResult {
  ok: boolean;
  summary: string;
  output: string;
}

// A problem that is safe to show the model, so its message must never contain
// real folder paths from this machine.
export class ToolError extends Error {}
