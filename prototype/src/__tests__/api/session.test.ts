import { describe, it, expect, vi, beforeEach } from "vitest";

describe("POST /api/session", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 401 when not authenticated", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("@/lib/db", () => ({
      db: {},
    }));

    const { POST } = await import("@/app/api/session/route");
    const result = await POST();
    expect(result.status).toBe(401);
  });

  it("creates a Session record in DB and returns sessionId with ephemeral token", async () => {
    const createdSession = {
      id: "session-1",
      userId: "user-1",
      targetLanguage: "en",
      startedAt: new Date(),
      endedAt: null,
    };

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
    vi.doMock("@/lib/db", () => ({
      db: {
        user: {
          findUnique: vi.fn().mockResolvedValue({ targetLanguage: "en" }),
        },
        session: {
          create: vi.fn().mockResolvedValue(createdSession),
        },
      },
    }));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ value: "test-token", expires_at: 1234567890 }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { POST } = await import("@/app/api/session/route");
    const result = await POST();
    expect(result.status).toBe(200);

    const data = await result.json();
    expect(data.value).toBe("test-token");
    expect(data.sessionId).toBe("session-1");
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
    vi.doMock("@/lib/db", () => ({
      db: {
        user: {
          findUnique: vi.fn().mockResolvedValue({ targetLanguage: "en" }),
        },
        session: {
          create: vi.fn().mockResolvedValue({ id: "session-1" }),
        },
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
