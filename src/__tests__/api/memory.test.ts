import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

describe("POST /api/memory", () => {
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

    const { POST } = await import("@/app/api/memory/route");
    const request = new NextRequest("http://localhost:3000/api/memory", {
      method: "POST",
      body: JSON.stringify({
        original: "I goed to store",
        corrected: "I went to the store",
        type: "grammar",
        targetLanguage: "en",
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

    const { POST } = await import("@/app/api/memory/route");
    const request = new NextRequest("http://localhost:3000/api/memory", {
      method: "POST",
      body: JSON.stringify({ original: "test" }),
    });
    const result = await POST(request);
    expect(result.status).toBe(400);
  });
});

describe("GET /api/memory", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 401 when not authenticated", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(null),
    }));

    const { GET } = await import("@/app/api/memory/route");
    const request = new NextRequest("http://localhost:3000/api/memory");
    const result = await GET(request);
    expect(result.status).toBe(401);
  });
});
