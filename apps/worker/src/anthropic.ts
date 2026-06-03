import Anthropic from "@anthropic-ai/sdk";
import { QUESTION_PAPER_JSON_SCHEMA } from "./paperSchema.js";
import { buildSystemPrompt } from "./prompt.js";
import type { ChatMessage, GenerateFn } from "./generate.js";

/** Construct the Anthropic SDK client. */
export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

export interface ModelOptions {
  /** Model id, e.g. `claude-sonnet-4-6`. */
  model: string;
  /** Max output tokens for a single generation. */
  maxTokens: number;
}

/**
 * Wire a {@link GenerateFn} to the Anthropic Messages API using STRUCTURED
 * OUTPUTS: the request carries `output_config.format` of type `json_schema`
 * whose schema is the `QuestionPaper` content shape (server-assigned fields
 * omitted). The fixed system prompt is captured here so callers only pass the
 * evolving user/assistant turns. We still re-validate downstream — structured
 * outputs guarantee the shape, not our semantic invariants.
 */
export function createGenerateFn(
  client: Anthropic,
  options: ModelOptions,
): GenerateFn {
  const system = buildSystemPrompt();

  return async (messages: ChatMessage[]): Promise<string> => {
    const response = await client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens,
      system,
      messages,
      output_config: {
        format: { type: "json_schema", schema: QUESTION_PAPER_JSON_SCHEMA },
      },
    });

    if (response.stop_reason === "refusal") {
      throw new Error("Anthropic refused to generate the question paper");
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error(
        "Anthropic response was truncated (max_tokens reached); increase ANTHROPIC_MAX_TOKENS",
      );
    }

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      }
    }
    return text;
  };
}
