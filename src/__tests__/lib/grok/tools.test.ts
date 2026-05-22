import { describe, it, expect } from "vitest";
import { GROK_TOOLS, isKnownFunction } from "@/lib/grok/tools";

describe("GROK_TOOLS", () => {
  it("contains all 4 required function definitions", () => {
    const names = GROK_TOOLS.map((t) => t.name);
    expect(names).toContain("save_mistake");
    expect(names).toContain("get_user_history");
    expect(names).toContain("generate_exercise");
    expect(names).toContain("save_progress");
    expect(GROK_TOOLS).toHaveLength(4);
  });

  it("each tool has type, name, description, and parameters", () => {
    for (const tool of GROK_TOOLS) {
      expect(tool.type).toBe("function");
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters.type).toBe("object");
      expect(tool.parameters.properties).toBeDefined();
    }
  });

  it("save_mistake has required fields", () => {
    const tool = GROK_TOOLS.find((t) => t.name === "save_mistake")!;
    expect(tool.parameters.required).toEqual(["original", "corrected", "type", "targetLanguage"]);
  });
});

describe("isKnownFunction", () => {
  it("returns true for known function names", () => {
    expect(isKnownFunction("save_mistake")).toBe(true);
    expect(isKnownFunction("get_user_history")).toBe(true);
    expect(isKnownFunction("generate_exercise")).toBe(true);
    expect(isKnownFunction("save_progress")).toBe(true);
  });

  it("returns false for unknown function names", () => {
    expect(isKnownFunction("unknown")).toBe(false);
  });
});
