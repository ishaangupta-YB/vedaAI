import {
  BedrockRuntimeClient,
  ConverseCommand,
  OutputFormatType,
  type Message,
} from "@aws-sdk/client-bedrock-runtime";
import { QUESTION_PAPER_JSON_SCHEMA } from "./paperSchema.js";
import { buildSystemPrompt } from "./prompt.js";
import type { ChatMessage, GenerateFn } from "./generate.js";

/**
 * Construct the Bedrock Runtime client. Auth comes from the AWS credential
 * chain — for this project a Bedrock API key in `AWS_BEARER_TOKEN_BEDROCK`,
 * which the AWS SDK detects automatically (never read or logged here).
 * `adaptive` retry + `maxAttempts: 5` smooth over `ThrottlingException`.
 */
export function createBedrockClient(region: string): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region,
    maxAttempts: 5,
    retryMode: "adaptive",
  });
}

export interface ModelOptions {
  /** Bedrock model id / inference profile, e.g. `us.anthropic.claude-sonnet-4-5-...`. */
  modelId: string;
  /** Max output tokens for a single generation (MUST be set — quota mechanics). */
  maxTokens: number;
}

/**
 * Wire a {@link GenerateFn} to the Bedrock **Converse API** using STRUCTURED
 * OUTPUTS: `outputConfig.textFormat` carries a `json_schema` whose schema is the
 * `QuestionPaper` content shape (server-assigned fields omitted). On Bedrock,
 * structured outputs is available on the `bedrock-runtime` Converse/InvokeModel
 * path (NOT the Anthropic Messages path, which rejects `output_config` with
 * 400). The schema must be passed as a JSON **string**. We still re-validate
 * downstream — structured outputs guarantees the shape, not our semantic
 * invariants.
 */
export function createGenerateFn(
  client: BedrockRuntimeClient,
  options: ModelOptions,
): GenerateFn {
  const system = buildSystemPrompt();
  const schema = JSON.stringify(QUESTION_PAPER_JSON_SCHEMA);

  return async (messages: ChatMessage[]): Promise<string> => {
    const converseMessages: Message[] = messages.map((message) => ({
      role: message.role,
      content: [{ text: message.content }],
    }));

    const response = await client.send(
      new ConverseCommand({
        modelId: options.modelId,
        system: [{ text: system }],
        messages: converseMessages,
        inferenceConfig: { maxTokens: options.maxTokens },
        outputConfig: {
          textFormat: {
            type: OutputFormatType.JSON_SCHEMA,
            structure: {
              jsonSchema: {
                name: "question_paper",
                description: "A structured exam question paper.",
                schema,
              },
            },
          },
        },
      }),
    );

    const stopReason = response.stopReason;
    if (stopReason === "guardrail_intervened") {
      throw new Error("A guardrail blocked the Bedrock response");
    }
    if (stopReason === "content_filtered") {
      throw new Error("Bedrock filtered the response (content_filtered)");
    }
    if (stopReason === "max_tokens") {
      throw new Error(
        "Bedrock response was truncated (max_tokens reached); increase BEDROCK_MAX_TOKENS",
      );
    }

    let text = "";
    for (const block of response.output?.message?.content ?? []) {
      if (typeof block.text === "string") {
        text += block.text;
      }
    }
    return text;
  };
}
