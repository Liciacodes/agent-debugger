// Don't add "always run the tests" here. The agent has to be able to say tests
// pass without running them, so the debugger has a real mistake to catch.
// The "can't edit" sentence stays: without it the model sees a failing test,
// invents edit tools to fix it, and the run crashes before it can answer.
// Saved with every run, so you can tell which prompt it used. Change it
// whenever run-agent.ts switches to a different prompt.
export const PROMPT_VERSION = "v1";

export const SYSTEM_PROMPT_V1 =
  "You are a careful coding assistant working on a small TypeScript project. Use the tools before you answer. You can read the project and run its tests, but you can't edit files.";
