import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

describe("POST /api/session/end", () => {
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

    const { POST } = await import("@/app/api/session/end/route");
    const request = new NextRequest("http://localhost:3000/api/session/end", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-1" }),
    });
    const result = await POST(request);
    expect(result.status).toBe(401);
  });

  it("sets endedAt on the session", async () => {
    const updatedSession = {
      id: "session-1",
      userId: "user-1",
      targetLanguage: "en",
      startedAt: new Date(),
      endedAt: new Date(),
    };

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: { id: "user-1", email: "test@test.com" },
      }),
    }));
    vi.doMock("@/lib/db", () => ({
      db: {
        session: {
          update: vi.fn().mockResolvedValue(updatedSession),
        },
      },
    }));

    const { POST } = await import("@/app/api/session/end/route");
    const request = new NextRequest("http://localhost:3000/api/session/end", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-1" }),
    });
    const result = await POST(request);
    expect(result.status).toBe(200);

    const data = await result.json();
    expect(data.id).toBe("session-1");
    expect(data.endedAt).toBeDefined();
  });

  it("returns 400 when sessionId is missing", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: { id: "user-1", email: "test@test.com" },
      }),
    }));
    vi.doMock("@/lib/db", () => ({
      db: {},
    }));

    const { POST } = await import("@/app/api/session/end/route");
    const request = new NextRequest("http://localhost:3000/api/session/end", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const result = await POST(request);
    expect(result.status).toBe(400);
  });
});
