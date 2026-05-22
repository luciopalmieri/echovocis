import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

describe("POST /api/exercises", () => {
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

    const { POST } = await import("@/app/api/exercises/route");
    const request = new NextRequest("http://localhost:3000/api/exercises", {
      method: "POST",
      body: JSON.stringify({
        type: "drill",
        targetLanguage: "en",
        basedOnMistakeIds: [],
      }),
    });
    const result = await POST(request);
    expect(result.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: { id: "user-1", email: "test@test.com" },
      }),
    }));
    vi.doMock("@/lib/db", () => ({
      db: {},
    }));

    const { POST } = await import("@/app/api/exercises/route");
    const request = new NextRequest("http://localhost:3000/api/exercises", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const result = await POST(request);
    expect(result.status).toBe(400);
  });
});

describe("GET /api/exercises", () => {
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

    const { GET } = await import("@/app/api/exercises/route");
    const request = new NextRequest("http://localhost:3000/api/exercises");
    const result = await GET(request);
    expect(result.status).toBe(401);
  });
});
