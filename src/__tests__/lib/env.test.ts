import { describe, it, expect, vi, beforeEach } from "vitest";

describe("env", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("throws when required env vars are missing", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.GOOGLE_CLIENT_ID;
    try {
      const { env } = await import("@/lib/env");
      env.DATABASE_URL;
      expect.fail("Expected an error to be thrown");
    } catch (e) {
      expect((e as Error).message).toContain("Missing environment variable");
    }
  });

  it("returns values when all required env vars are set", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.GOOGLE_CLIENT_ID = "test-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.ALLOWED_EMAILS = "user@test.com";
    process.env.XAI_API_KEY = "test-key";

    const { env } = await import("@/lib/env");
    expect(env.DATABASE_URL).toBe("postgresql://test:test@localhost:5432/test");
    expect(env.SESSION_TTL_SECONDS).toBe(300);
  });

  it("validates email against allowlist", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.GOOGLE_CLIENT_ID = "test-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.ALLOWED_EMAILS = "user@test.com,admin@test.com";
    process.env.XAI_API_KEY = "test-key";

    const { env } = await import("@/lib/env");
    expect(env.isEmailAllowed("user@test.com")).toBe(true);
    expect(env.isEmailAllowed("unknown@test.com")).toBe(false);
    expect(env.isEmailAllowed("User@Test.COM")).toBe(true);
  });
});
