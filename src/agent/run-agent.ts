import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "groq-sdk/resources/chat/completions";
import { SYSTEM_PROMPT_V1 } from "./prompt";
import { executeTool, TOOL_DEFINITIONS } from "./tools";

export const MAX_ROUNDS = 6;

export interface ModelReply {
  content: string | null;
  reasoning: string | null;
  toolCalls: ChatCompletionMessageToolCall[];
  finishReason: string;
  totalTokens: number | null;
}

// The loop only knows this function, not Groq, so tests can pass in a fake model.
export type CallModel = (
  messages: ChatCompletionMessageParam[],
  tools: ChatCompletionTool[],
) => Promise<ModelReply>;

export type RunStatus = "answered" | "max_rounds" | "cut_off" | "model_error";

export interface AgentResult {
  status: RunStatus;
  answer: string | null;
  error: string | null;
  rounds: number;
  toolCallCount: number;
  durationMs: number;
}

// Everything that happens during a run. The terminal prints these today, and
// the recorder can listen to the same events later.
export type AgentStep =
  | { type: "run_start"; question: string }
  | { type: "model_call_start"; round: number }
  | {
      type: "model_call_end";
      round: number;
      durationMs: number;
      totalTokens: number | null;
      toolCallCount: number;
      finishReason: string;
      content: string | null;
      reasoning: string | null;
    }
  | { type: "tool_call_start"; round: number; name: string; args: string }
  | {
      type: "tool_call_end";
      round: number;
      name: string;
      durationMs: number;
      ok: boolean;
      summary: string;
      output: string;
    }
  | ({ type: "run_end" } & AgentResult);

interface RunAgentOptions {
  question: string;
  callModel: CallModel;
  rootDir: string;
  onStep?: (step: AgentStep) => void;
}

export async function runAgent({
  question,
  callModel,
  rootDir,
  onStep = () => {},
}: RunAgentOptions): Promise<AgentResult> {
  const startedAt = performance.now();
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT_V1 },
    { role: "user", content: question },
  ];
  let toolCallCount = 0;

  function finish(
    status: RunStatus,
    rounds: number,
    details: { answer?: string; error?: string },
  ): AgentResult {
    const result: AgentResult = {
      status,
      answer: details.answer ?? null,
      error: details.error ?? null,
      rounds,
      toolCallCount,
      durationMs: performance.now() - startedAt,
    };
    onStep({ type: "run_end", ...result });
    return result;
  }

  onStep({ type: "run_start", question });

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    onStep({ type: "model_call_start", round });
    const modelStartedAt = performance.now();

    let reply: ModelReply;
    try {
      reply = await callModel(messages, TOOL_DEFINITIONS);
    } catch (error) {
      return finish("model_error", round, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    onStep({
      type: "model_call_end",
      round,
      durationMs: performance.now() - modelStartedAt,
      totalTokens: reply.totalTokens,
      toolCallCount: reply.toolCalls.length,
      finishReason: reply.finishReason,
      content: reply.content,
      reasoning: reply.reasoning,
    });

    if (reply.finishReason === "length") {
      return finish("cut_off", round, {
        error: "The model ran out of output tokens before finishing.",
      });
    }

    if (reply.toolCalls.length === 0) {
      if (!reply.content?.trim()) {
        return finish("model_error", round, {
          error: "The model returned no answer and no tool call.",
        });
      }
      return finish("answered", round, { answer: reply.content });
    }

    // Reasoning stays out of the history: the model only needs what it said
    // and did, and the step events above already carry the reasoning.
    messages.push({
      role: "assistant",
      content: reply.content,
      tool_calls: reply.toolCalls,
    });

    for (const toolCall of reply.toolCalls) {
      const { name, arguments: args } = toolCall.function;
      toolCallCount += 1;
      onStep({ type: "tool_call_start", round, name, args });

      const toolStartedAt = performance.now();
      const result = await executeTool(name, args, rootDir);

      onStep({
        type: "tool_call_end",
        round,
        name,
        durationMs: performance.now() - toolStartedAt,
        ...result,
      });
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result.output,
      });
    }
  }

  return finish("max_rounds", MAX_ROUNDS, {
    error: `Hit the limit of ${MAX_ROUNDS} rounds without an answer.`,
  });
}
