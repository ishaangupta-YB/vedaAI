import { describe, expect, it, vi } from "vitest";
import type { CreateAssignmentInput } from "@veda-ai/shared";
import {
  PaperValidationError,
  generatePaperContent,
  type GenerateFn,
} from "./generate.js";

const input: CreateAssignmentInput = {
  title: "Algebra Quiz",
  dueDate: "2999-01-01T00:00:00.000Z",
  questionConfigs: [{ type: "mcq", count: 1, marksPerQuestion: 2 }],
};

const validContent = {
  title: "Algebra Quiz",
  sections: [
    {
      title: "Section A",
      instruction: "Choose the single best option for each question.",
      questions: [
        {
          text: "What is 2 + 2?",
          type: "mcq",
          difficulty: "easy",
          marks: 2,
          options: ["3", "4", "5", "6"],
          answer: "4",
        },
      ],
    },
  ],
};

const validJson = JSON.stringify(validContent);

/** A model output that is valid JSON but violates the schema (empty sections). */
const schemaInvalidJson = JSON.stringify({ title: "Algebra Quiz", sections: [] });

/** Valid JSON but violates a semantic invariant (mcq with a single option). */
const invariantInvalidJson = JSON.stringify({
  title: "Algebra Quiz",
  sections: [
    {
      title: "Section A",
      instruction: "Choose.",
      questions: [
        { text: "Q?", type: "mcq", difficulty: "easy", marks: 2, options: ["only"] },
      ],
    },
  ],
});

const malformedJson = "this is not json {";

function fakeGenerate(responses: string[]): GenerateFn {
  const mock = vi.fn<(args: unknown) => Promise<string>>();
  for (const response of responses) {
    mock.mockResolvedValueOnce(response);
  }
  // Fall back to the last response for any extra calls.
  mock.mockResolvedValue(responses[responses.length - 1] ?? "");
  return mock as unknown as GenerateFn;
}

describe("generatePaperContent", () => {
  it("returns validated content on the first try (no repair)", async () => {
    const generate = fakeGenerate([validJson]);
    const result = await generatePaperContent(generate, input);
    expect(result).toEqual(validContent);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("repairs malformed JSON with exactly one repair round-trip", async () => {
    const generate = fakeGenerate([malformedJson, validJson]);
    const result = await generatePaperContent(generate, input);
    expect(result).toEqual(validContent);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("repairs a semantic-invariant violation (mcq with too few options)", async () => {
    const generate = fakeGenerate([invariantInvalidJson, validJson]);
    const result = await generatePaperContent(generate, input);
    expect(result).toEqual(validContent);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("feeds the concrete Zod issues back to the model on repair", async () => {
    const generate = vi.fn<(messages: { role: string; content: string }[]) => Promise<string>>();
    generate.mockResolvedValueOnce(schemaInvalidJson).mockResolvedValueOnce(validJson);
    await generatePaperContent(generate as unknown as GenerateFn, input);

    const repairMessages = generate.mock.calls[1]![0];
    const repairPrompt = repairMessages[repairMessages.length - 1]!.content;
    expect(repairPrompt).toContain("Problems:");
    expect(repairPrompt).toContain("sections");
    // The previous (bad) output must be in-context as an assistant turn.
    expect(repairMessages.some((m) => m.role === "assistant")).toBe(true);
  });

  it("throws PaperValidationError after a failed repair", async () => {
    const generate = fakeGenerate([schemaInvalidJson, schemaInvalidJson]);
    await expect(generatePaperContent(generate, input)).rejects.toBeInstanceOf(
      PaperValidationError,
    );
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("throws cleanly when both attempts are unparseable JSON", async () => {
    const generate = fakeGenerate([malformedJson, malformedJson]);
    await expect(generatePaperContent(generate, input)).rejects.toBeInstanceOf(
      PaperValidationError,
    );
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
