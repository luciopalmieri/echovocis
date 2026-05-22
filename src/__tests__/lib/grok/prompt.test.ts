import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/grok/prompt";

describe("buildSystemPrompt", () => {
  it("fills in language placeholders", () => {
    const prompt = buildSystemPrompt({
      nativeLanguage: "it",
      targetLanguage: "en",
      recentMistakes: [],
      sessionCount: 0,
    });

    expect(prompt).toContain("Italian");
    expect(prompt).toContain("English");
    expect(prompt).not.toContain("{nativeLanguage}");
    expect(prompt).not.toContain("{targetLanguage}");
  });

  it("includes recent mistakes when provided", () => {
    const prompt = buildSystemPrompt({
      nativeLanguage: "it",
      targetLanguage: "en",
      recentMistakes: [
        { original: "I goed", corrected: "I went", type: "grammar" },
        { original: "she speak", corrected: "she speaks", type: "grammar" },
      ],
      sessionCount: 5,
    });

    expect(prompt).toContain("I goed");
    expect(prompt).toContain("I went");
    expect(prompt).toContain("5");
  });

  it("shows no mistakes message when list is empty", () => {
    const prompt = buildSystemPrompt({
      nativeLanguage: "it",
      targetLanguage: "en",
      recentMistakes: [],
      sessionCount: 0,
    });

    expect(prompt).toContain("No previous mistakes recorded");
  });
});
