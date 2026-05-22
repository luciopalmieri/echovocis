import { describe, it, expect, vi, beforeEach } from "vitest";

describe("POST /api/session", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 401 when not authenticated", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(null),
    }));

    const { POST } = await import("@/app/api/session/route");
    const result = await POST();
    expect(result.status).toBe(401);
  });

  it("returns ephemeral token when authenticated", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: { id: "user-1", email: "test@test.com" },
      }),
    }));
    vi.doMock("@/lib/env", () => ({
      env: {
        XAI_API_KEY: "test-key",
        SESSION_TTL_SECONDS: 300,
      },
    }));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ client_secret: { value: "test-token" } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { POST } = await import("@/app/api/session/route");
    const result = await POST();
    expect(result.status).toBe(200);

    const data = await result.json();
    expect(data.client_secret.value).toBe("test-token");
  });

  it("returns error when x.ai fetch fails", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: { id: "user-1", email: "test@test.com" },
      }),
    }));
    vi.doMock("@/lib/env", () => ({
      env: {
        XAI_API_KEY: "test-key",
        SESSION_TTL_SECONDS: 300,
      },
    }));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { POST } = await import("@/app/api/session/route");
    const result = await POST();
    expect(result.status).toBe(500);
  });
});
