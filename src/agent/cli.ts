import path from "node:path";
import { loadEnvFiles } from "../lib/env";
import { countLabel, formatDuration, formatTokens } from "../lib/format";
import { createRecorder } from "../recorder/recorder";
import { DEFAULT_RECORDER_URL, describeSendResult, sendRun } from "../recorder/send";
import { newRunId, saveRun } from "../recorder/store";
import { createGroqModel, MODEL } from "./model";
import { PROMPT_VERSION } from "./prompt";
import { runAgent, type AgentStep } from "./run-agent";

const AGENT_NAME = "code-helper";
const MAX_ARGS_SHOWN = 200;

function printStep(step: AgentStep): void {
  switch (step.type) {
    case "run_start":
      console.log(`${AGENT_NAME}  ${JSON.stringify(step.question)}\n`);
      break;
    case "model_call_start":
      console.log(`round ${step.round}  model call...`);
      break;
    case "model_call_end": {
      let action = "model answered";
      if (step.finishReason === "length") {
        action = "model output was cut off";
      } else if (step.toolCallCount > 0) {
        action = `model asked for ${countLabel(step.toolCallCount, "tool")}`;
      } else if (!step.content?.trim()) {
        action = "model returned an empty reply";
      }
      console.log(
        `round ${step.round}  ${action} (${formatDuration(step.durationMs)}, ${formatTokens(step.totalTokens)})`,
      );
      break;
    }
    case "tool_call_start":
      console.log(
        `         ${step.name} ${step.args.slice(0, MAX_ARGS_SHOWN)}`,
      );
      break;
    case "tool_call_end":
      console.log(
        `         -> ${step.ok ? "" : "ERROR: "}${step.summary} (${formatDuration(step.durationMs)})`,
      );
      break;
    case "run_end":
      if (step.answer !== null) {
        console.log(`\nANSWER\n${step.answer}`);
      } else {
        console.log(`\nSTOPPED (${step.status})\n${step.error}`);
      }
      console.log(
        `\ndone: ${countLabel(step.rounds, "round")}, ${countLabel(step.toolCallCount, "tool call")}, ${formatDuration(step.durationMs)}`,
      );
      break;
  }
}

async function main(): Promise<number> {
  const question = process.argv.slice(2).join(" ").trim();

  if (question === "") {
    console.error('Usage: npm run agent -- "your question"');
    return 1;
  }

  // A missing .env.local is fine here: createGroqModel explains what's missing.
  loadEnvFiles();

  const recorder = createRecorder({
    id: newRunId(),
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    // Only so the recorder can hide the key if it ever turns up in a step.
    secrets: [process.env.GROQ_API_KEY],
  });

  const result = await runAgent({
    question,
    callModel: createGroqModel(),
    rootDir: path.join(process.cwd(), "sample-project"),
    // Recorded before it's printed, so printing time doesn't shift the start times.
    onStep: (step) => {
      recorder.onStep(step);
      printStep(step);
    },
  });

  // The file is saved first, as a backup if the server isn't running.
  const run = recorder.getRun();
  await saveRun(run);
  console.log(`saved ${run.id}  (npm run show -- ${run.id})`);

  const url = process.env.RECORDER_URL || DEFAULT_RECORDER_URL;
  const sent = await sendRun(run, { url, token: process.env.RECORDER_TOKEN });
  console.log(describeSendResult(sent, url));

  return result.status === "answered" ? 0 : 1;
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
