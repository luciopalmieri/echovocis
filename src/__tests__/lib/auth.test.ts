import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({
  default: (config: unknown) => ({
    auth: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("next-auth/providers/google", () => ({
  default: (opts: Record<string, unknown> = {}) => ({ id: "google", ...opts }),
}));

describe("auth configuration", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("exports authOptions with Google provider and pages config", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.ALLOWED_EMAILS = "user@test.com";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.XAI_API_KEY = "test-key";

    const { authOptions } = await import("@/lib/auth");
    expect(authOptions.providers).toBeDefined();
    expect(authOptions.pages).toEqual({
      signIn: "/login",
      error: "/login",
    });
  });
});
