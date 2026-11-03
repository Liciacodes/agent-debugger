import "server-only";
import Groq from "groq-sdk";
import type { CallModel } from "./run-agent";


export const MODEL = "openai/gpt-oss-120b";

// Groq's default is 1024, which reasoning can use up before the answer starts.
const MAX_OUTPUT_TOKENS = 4096;

export function createGroqModel(): CallModel {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is missing. Copy .env.example to .env.local and add your key.",
    );
  }

  const client = new Groq({ apiKey });

  return async (messages, tools) => {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      reasoning_effort: "low",
    });
    const choice = response.choices[0];

    if (!choice) {
      throw new Error("Groq returned a response with no choices.");
    }

    return {
      content: choice.message.content,
      reasoning: choice.message.reasoning ?? null,
      toolCalls: choice.message.tool_calls ?? [],
      finishReason: choice.finish_reason,
      totalTokens: response.usage?.total_tokens ?? null,
    };
  };
}
