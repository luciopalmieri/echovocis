import { describe, it, expect } from "vitest";
import { float32ToBase64PCM16, base64PCM16ToFloat32, SAMPLE_RATE } from "@/lib/grok/audio";

describe("float32ToBase64PCM16", () => {
  it("converts silence to base64 PCM16", () => {
    const silence = new Float32Array(10);
    const result = float32ToBase64PCM16(silence);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("produces valid base64", () => {
    const signal = new Float32Array([0.5, -0.5, 0.0, 1.0, -1.0]);
    const result = float32ToBase64PCM16(signal);
    const decoded = atob(result);
    expect(decoded.length).toBe(signal.length * 2);
  });
});

describe("base64PCM16ToFloat32", () => {
  it("round-trips float32 → base64 → float32", () => {
    const original = new Float32Array([0.5, -0.5, 0.0, 0.25, -0.75]);
    const base64 = float32ToBase64PCM16(original);
    const result = base64PCM16ToFloat32(base64);

    expect(result.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(Math.abs(result[i] - original[i])).toBeLessThan(0.001);
    }
  });

  it("handles empty input", () => {
    const empty = new Float32Array(0);
    const base64 = float32ToBase64PCM16(empty);
    const result = base64PCM16ToFloat32(base64);
    expect(result.length).toBe(0);
  });
});

describe("SAMPLE_RATE", () => {
  it("is 24000 Hz (Grok default)", () => {
    expect(SAMPLE_RATE).toBe(24000);
  });
});
