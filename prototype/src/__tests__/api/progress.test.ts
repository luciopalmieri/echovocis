import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

describe("POST /api/progress", () => {
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

    const { POST } = await import("@/app/api/progress/route");
    const request = new NextRequest("http://localhost:3000/api/progress", {
      method: "POST",
      body: JSON.stringify({
        sentencesSpoken: 5,
        mistakesCount: 2,
        correctionsAccepted: 1,
        targetLanguage: "en",
      }),
    });
    const result = await POST(request);
    expect(result.status).toBe(401);
  });

  it("returns 400 when targetLanguage is missing", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: { id: "user-1", email: "test@test.com" },
      }),
    }));
    vi.doMock("@/lib/db", () => ({
      db: {},
    }));

    const { POST } = await import("@/app/api/progress/route");
    const request = new NextRequest("http://localhost:3000/api/progress", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const result = await POST(request);
    expect(result.status).toBe(400);
  });
});

describe("GET /api/progress", () => {
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

    const { GET } = await import("@/app/api/progress/route");
    const request = new NextRequest("http://localhost:3000/api/progress");
    const result = await GET(request);
    expect(result.status).toBe(401);
  });
});
