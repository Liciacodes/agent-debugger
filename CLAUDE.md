@AGENTS.md

# Agent debugger (name TBD)

A tool that records every step an AI agent takes, shows where it went wrong, and lets you fix and replay it.

## Working with me

I'm learning, so explain changes simply: what changed, why it changed, and any new idea in plain words.

## Locked v1 scope

In v1:

- Practice coding agent
- Recorder for every step
- Server + Postgres
- UI: runs list, waterfall timeline, step details
- Automatic flags
- Replay (live or from recording) + before/after compare
- Saved tests with "run all"
- MCP tool calls recorded
- Deployed with a safe demo

Not in v1: accounts, Python agent, AI explanations, cost analytics.

## UI

The UI must follow `docs/design/graphite-v3.html`. It is a visual reference only (layout, colours, fonts, spacing). Ignore its `./support.js`, and build the UI properly rather than copying its markup.

## Mistakes kept on purpose

The debugger needs real mistakes to catch, so don't "fix" these:

- `sample-project/src/cart.ts` has a discount bug, and exactly one test fails because of it. Don't add comments there that give the bug away, because the agent reads that code.
- `src/agent/prompt.ts` must not tell the agent to always run tests, and the `run_tests` description stays neutral. The agent has to be able to say tests pass without running them.

## Code I'm writing myself

- `computeTotals` in `src/recorder/totals.ts` is mine. Don't change it or its tests unless I ask.

## Failure types seen in real runs

These become the debugger's automatic flags later:

- **Unknown tool:** the model calls a tool that doesn't exist, such as `edit_file` or `apply_patch`. Groq rejects the request with `tool_use_failed` and the run stops.
- **Malformed arguments:** the model sends tool arguments that aren't valid JSON. Groq rejects these with `tool_use_failed` too.
- **Round limit:** the run uses all 6 rounds without answering.
- **Empty reply:** the model finishes with no answer and no tool call.
- **Claim without evidence:** the model states something it never checked. The target mistake, saying tests pass without calling `run_tests`, hasn't appeared yet (0 of 39 tests-style runs on `openai/gpt-oss-20b` as of 2026-11-02; the model has changed since, so these results may not carry over). Weaker forms have: quoting test code it never read, with the details wrong, and promising all tests will pass after a fix nobody ran.

## Rules

- The agent uses `openai/gpt-oss-120b`. Don't use the same Groq model as my Relay app, so runs here don't use up its daily token limit.
- Real-model runs spend a shared daily limit, so don't run batches of them without asking me first.
- `GROQ_API_KEY` lives in `.env.local` and is server-only. Never give it a `NEXT_PUBLIC_` prefix.
- Saved runs must never contain the key. Every piece of text the recorder stores goes through its cleaning step, which hides keys and trims long text.
- Every path a tool receives goes through `src/agent/tools/safe-path.ts`. Tools can't reach anything outside `sample-project/`.
- Keep Next's default config files, with no `"type": "module"` in `package.json`.

## Commands

- `npm run agent -- "your question"` runs the practice agent and saves the run to `runs/<id>.json`
- `npm run runs` lists saved runs, newest first
- `npm run show -- <id>` prints one saved run as a tree with timings
- `npm test` runs our own tests, with no API key needed
- `npm run test:sample` runs the sample project's tests (1 failure is expected)
