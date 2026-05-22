# EchoVocis V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a voice-first web app that helps users improve spoken fluency in foreign languages through real-time conversation with Emma, an AI voice coach.

**Architecture:** Next.js 15 App Router with server-side auth, Prisma ORM on PostgreSQL, and Grok Voice Agent API over WebSocket. The browser connects directly to Grok via ephemeral tokens; function calls from Emma route through the browser to backend API routes.

**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma, PostgreSQL, Tailwind CSS 4, NextAuth.js v5 (beta), Grok Voice Agent API, Vitest

---

## File Structure Map

Files created/modified by this plan, organized by responsibility:

```
echovocis/
├── .env.local                          # All env vars (Task 1)
├── .env.example                        # Template for env vars (Task 1)
├── package.json                        # Dependencies (Task 1)
├── next.config.ts                      # Next.js config (Task 1)
├── tsconfig.json                       # TypeScript config (Task 1)
├── vitest.config.ts                    # Test config (Task 1)
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout (Task 8)
│   │   ├── page.tsx                    # Landing page (Task 9)
│   │   ├── globals.css                 # Tailwind base styles (Task 8)
│   │   ├── (auth)/
│   │   │   └── login/page.tsx          # Login page (Task 10)
│   │   ├── (app)/
│   │   │   ├── layout.tsx              # Auth-protected layout (Task 8)
│   │   │   ├── onboarding/page.tsx     # Language selection (Task 11)
│   │   │   ├── practice/page.tsx       # Voice conversation (Task 19)
│   │   │   ├── exercises/page.tsx      # Exercise list (Task 20)
│   │   │   ├── progress/page.tsx       # Stats + streak (Task 21)
│   │   │   └── settings/page.tsx       # Profile + languages (Task 12)
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts  # NextAuth handler (Task 3)
│   │       ├── session/route.ts        # Ephemeral token (Task 4)
│   │       ├── memory/route.ts         # Mistake CRUD + dedup (Task 5)
│   │       ├── exercises/route.ts      # Exercise generation (Task 6)
│   │       └── progress/route.ts       # Progress counters (Task 7)
│   ├── lib/
│   │   ├── env.ts                      # Env validation (Task 1)
│   │   ├── db.ts                       # Prisma client singleton (Task 2)
│   │   ├── auth.ts                     # NextAuth config + helpers (Task 3)
│   │   └── grok/
│   │       ├── prompt.ts               # Emma system prompt builder (Task 13)
│   │       ├── tools.ts                # Function schemas + types (Task 14)
│   │       ├── audio.ts                # PCM16 conversion + AudioContext (Task 15)
│   │       └── client.ts              # WebSocket client + events (Task 16)
│   ├── components/
│   │   ├── Navbar.tsx                  # Top nav bar (Task 8)
│   │   ├── LanguageFlag.tsx            # Flag emoji helper (Task 11)
│   │   └── voice/
│   │       ├── VoiceButton.tsx         # Mic button with states (Task 17)
│   │       ├── TranscriptPanel.tsx     # Live transcript area (Task 17)
│   │       ├── CorrectionCard.tsx      # Correction display card (Task 17)
│   │       └── VoiceConversation.tsx   # Main voice orchestrator (Task 18)
│   └── __tests__/
│       ├── lib/
│       │   ├── env.test.ts             # (Task 1)
│       │   ├── grok/
│       │   │   ├── prompt.test.ts      # (Task 13)
│       │   │   ├── tools.test.ts       # (Task 14)
│       │   │   └── audio.test.ts       # (Task 15)
│       │   └── auth.test.ts            # (Task 3)
│       └── api/
│           ├── session.test.ts         # (Task 4)
│           ├── memory.test.ts          # (Task 5)
│           ├── exercises.test.ts       # (Task 6)
│           └── progress.test.ts        # (Task 7)
├── prisma/
│   └── schema.prisma                   # All models (Task 2)
└── middleware.ts                       # Auth middleware (Task 3)
```

---

## Phase 1: Foundation

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `.env.local`, `.env.example`, `src/lib/env.ts`, `src/app/globals.css`
- Test: `src/__tests__/lib/env.test.ts`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd /Users/luciopalmieri/Projects/_training/echovocis
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --turbopack
```

Accept defaults. This creates the base Next.js 15 project with Tailwind CSS 4 and App Router.

- [ ] **Step 2: Install dependencies**

```bash
npm install next-auth@beta @prisma/client @auth/prisma-adapter
npm install -D prisma vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @types/node
```

- [ ] **Step 3: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and updates `.env` with `DATABASE_URL`. Rename `.env` to `.env.local` if needed.

- [ ] **Step 4: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Add test script to `package.json`:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:run": "vitest run",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:seed": "prisma db seed"
  }
}
```

- [ ] **Step 5: Create environment variable validation**

Create `src/lib/env.ts`:

```typescript
function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export const env = {
  get DATABASE_URL() {
    return getEnv("DATABASE_URL");
  },
  get GOOGLE_CLIENT_ID() {
    return getEnv("GOOGLE_CLIENT_ID");
  },
  get GOOGLE_CLIENT_SECRET() {
    return getEnv("GOOGLE_CLIENT_SECRET");
  },
  get NEXTAUTH_SECRET() {
    return getEnv("NEXTAUTH_SECRET");
  },
  get NEXTAUTH_URL() {
    return process.env.NEXTAUTH_URL || "http://localhost:3000";
  },
  get ALLOWED_EMAILS() {
    return getEnv("ALLOWED_EMAILS");
  },
  get XAI_API_KEY() {
    return getEnv("XAI_API_KEY");
  },
  get SESSION_TTL_SECONDS() {
    return parseInt(process.env.SESSION_TTL_SECONDS || "300", 10);
  },
  get isEmailAllowed() {
    const allowed = this.ALLOWED_EMAILS.split(",").map((e) => e.trim().toLowerCase());
    return (email: string) => allowed.includes(email.toLowerCase());
  },
} as const;
```

- [ ] **Step 6: Create .env.example**

Create `.env.example`:

```
# Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
ALLOWED_EMAILS=user1@gmail.com,user2@gmail.com

# Database
DATABASE_URL=

# Grok Voice
XAI_API_KEY=
SESSION_TTL_SECONDS=300
```

- [ ] **Step 7: Write test for env validation**

Create `src/__tests__/lib/env.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("env", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("throws when required env vars are missing", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.GOOGLE_CLIENT_ID;
    await expect(import("@/lib/env")).rejects.toThrow("Missing environment variable");
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
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
DATABASE_URL=test GOOGLE_CLIENT_ID=test GOOGLE_CLIENT_SECRET=test NEXTAUTH_SECRET=test ALLOWED_EMAILS=test@test.com XAI_API_KEY=test npm run test:run -- src/__tests__/lib/env.test.ts
```

Expected: PASS

- [ ] **Step 9: Create placeholder .env.local with all vars**

Copy `.env.example` to `.env.local` and fill in real values (or placeholders for local dev). Ensure `.env.local` is in `.gitignore`.

- [ ] **Step 10: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold Next.js 15 project with Prisma, auth, and test tooling"
```

---

### Task 2: Prisma Schema + Database

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`

- [ ] **Step 1: Write the Prisma schema**

Replace `prisma/schema.prisma` with the complete schema from the design doc:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  name                String?
  image               String?
  nativeLanguage      String    @default("it")
  targetLanguage      String    @default("en")
  onboardingCompleted Boolean   @default(false)
  createdAt           DateTime  @default(now())

  sessions   Session[]
  mistakes   Mistake[]
  exercises  Exercise[]
  progress   Progress[]
}

model Session {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  targetLanguage String   @default("en")
  startedAt      DateTime @default(now())
  endedAt        DateTime?

  mistakes  Mistake[]

  @@index([userId, startedAt])
}

model Mistake {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  original        String
  corrected       String
  type            String
  targetLanguage  String
  sessionId       String?
  session         Session?  @relation(fields: [sessionId], references: [id])
  occurrenceCount Int      @default(1)
  lastSeenAt      DateTime @default(now())
  createdAt       DateTime @default(now())

  exercises Exercise[]

  @@index([userId, targetLanguage, lastSeenAt])
}

model Progress {
  id                  String   @id @default(cuid())
  userId              String
  user                User     @relation(fields: [userId], references: [id])
  date                DateTime @default(now())
  targetLanguage      String
  sentencesSpoken     Int      @default(0)
  mistakesCount       Int      @default(0)
  correctionsAccepted Int      @default(0)
  streakDays          Int      @default(0)

  @@unique([userId, targetLanguage, date])
  @@index([userId, targetLanguage])
}

model Exercise {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  targetLanguage  String
  type            String
  content         String
  completed       Boolean   @default(false)
  completedAt     DateTime?
  score           Int?
  createdAt       DateTime  @default(now())

  basedOnMistakes Mistake[]
}
```

- [ ] **Step 2: Create Prisma client singleton**

Create `src/lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
```

- [ ] **Step 3: Push schema to database**

```bash
npx prisma db push
```

Expected: Schema synced, no errors. (Requires a running PostgreSQL with `DATABASE_URL` in `.env.local`.)

- [ ] **Step 4: Generate Prisma client**

```bash
npx prisma generate
```

Expected: Client generated successfully.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Prisma schema with User, Session, Mistake, Progress, Exercise models"
```

---

### Task 3: Authentication

**Files:**
- Create: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `middleware.ts`
- Test: `src/__tests__/lib/auth.test.ts`

- [ ] **Step 1: Write failing test for auth helpers**

Create `src/__tests__/lib/auth.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("auth configuration", () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/__tests__/lib/auth.test.ts
```

Expected: FAIL — `auth.ts` does not exist.

- [ ] **Step 3: Create NextAuth configuration**

Create `src/lib/auth.ts`:

```typescript
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import { env } from "./env";

export const authOptions: NextAuthConfig = {
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return env.isEmailAllowed(user.email);
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: env.NEXTAUTH_SECRET,
};
```

- [ ] **Step 4: Create NextAuth route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

- [ ] **Step 5: Create middleware for route protection**

Create `middleware.ts` at project root:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  const publicRoutes = ["/", "/login"];
  const isPublicRoute = publicRoutes.includes(pathname);
  const isAuthRoute = pathname.startsWith("/api/auth");

  if (isAuthRoute) return NextResponse.next();

  if (isPublicRoute) {
    if (isLoggedIn && pathname === "/login") {
      return NextResponse.redirect(new URL("/practice", req.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**Note:** The `auth` import from `next-auth` requires the following approach for middleware. Update `src/lib/auth.ts` to also export the middleware helper:

```typescript
import NextAuth from "next-auth";

export const { auth, handlers, signIn, signOut } = NextAuth(authOptions);
export { authOptions };
```

Then update the route handler to use `handlers`:

```typescript
import { handlers } from "@/lib/auth";

const { GET, POST } = handlers;
export { GET, POST };
```

And the middleware becomes:

```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  const publicRoutes = ["/", "/login"];
  const isPublicRoute = publicRoutes.includes(pathname);
  const isAuthRoute = pathname.startsWith("/api/auth");

  if (isAuthRoute) return NextResponse.next();

  if (isPublicRoute) {
    if (isLoggedIn && pathname === "/login") {
      return NextResponse.redirect(new URL("/practice", req.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

Update `src/lib/auth.ts` final version:

```typescript
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import { env } from "./env";

export const authOptions: NextAuthConfig = {
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return env.isEmailAllowed(user.email);
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: env.NEXTAUTH_SECRET,
};

const result = NextAuth(authOptions);
export const { auth, handlers, signIn, signOut } = result;
```

- [ ] **Step 6: Add type augmentation for session**

Create `src/types/next-auth.d.ts`:

```typescript
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
```

- [ ] **Step 7: Run tests**

```bash
npm run test:run -- src/__tests__/lib/auth.test.ts
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: add Google OAuth auth with email allowlist and route middleware"
```

---

## Phase 2: Backend APIs

---

### Task 4: Ephemeral Token API

**Files:**
- Create: `src/app/api/session/route.ts`
- Test: `src/__tests__/api/session.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/api/session.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("POST /api/session", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 401 when not authenticated", async () => {
    const { POST } = await import("@/app/api/session/route");
    const response = POST(new Request("http://localhost:3000/api/session"));
    const result = await response;
    expect(result.status).toBe(401);
  });

  it("returns ephemeral token when authenticated", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ client_secret: { value: "test-token" } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { POST } = await import("@/app/api/session/route");
    const request = new Request("http://localhost:3000/api/session", {
      method: "POST",
    });

    const authMock = vi.fn().mockResolvedValue({
      user: { id: "user-1", email: "test@test.com" },
    });
    vi.doMock("@/lib/auth", () => ({ auth: authMock }));

    const result = await POST(request);
    expect(result.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/__tests__/api/session.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create the session API route**

Create `src/app/api/session/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: { seconds: env.SESSION_TTL_SECONDS },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to create ephemeral token:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
```

- [ ] **Step 4: Run test**

```bash
npm run test:run -- src/__tests__/api/session.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add ephemeral token endpoint for Grok Voice API"
```

---

### Task 5: Memory API (Mistake CRUD + Dedup)

**Files:**
- Create: `src/app/api/memory/route.ts`
- Test: `src/__tests__/api/memory.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/api/memory.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

describe("POST /api/memory", () => {
  it("returns 401 when not authenticated", async () => {
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
});

describe("GET /api/memory", () => {
  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/memory/route");
    const request = new NextRequest("http://localhost:3000/api/memory");
    const result = await GET(request);
    expect(result.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/__tests__/api/memory.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create the memory API route**

Create `src/app/api/memory/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { original, corrected, type, targetLanguage, sessionId } = body;

  if (!original || !corrected || !type || !targetLanguage) {
    return NextResponse.json(
      { error: "Missing required fields: original, corrected, type, targetLanguage" },
      { status: 400 }
    );
  }

  const validTypes = ["grammar", "vocabulary", "pronunciation", "fluency"];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  const existing = await db.mistake.findFirst({
    where: {
      userId: session.user.id,
      targetLanguage,
      original,
    },
  });

  if (existing) {
    const updated = await db.mistake.update({
      where: { id: existing.id },
      data: {
        corrected,
        type,
        occurrenceCount: { increment: 1 },
        lastSeenAt: new Date(),
        sessionId: sessionId || existing.sessionId,
      },
    });
    return NextResponse.json(updated);
  }

  const mistake = await db.mistake.create({
    data: {
      userId: session.user.id,
      original,
      corrected,
      type,
      targetLanguage,
      sessionId,
    },
  });

  return NextResponse.json(mistake, { status: 201 });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);
  const targetLanguage = searchParams.get("targetLanguage");

  const mistakes = await db.mistake.findMany({
    where: {
      userId: session.user.id,
      ...(targetLanguage ? { targetLanguage } : {}),
    },
    orderBy: { lastSeenAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ mistakes });
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- src/__tests__/api/memory.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add memory API with mistake CRUD and deduplication"
```

---

### Task 6: Exercises API

**Files:**
- Create: `src/app/api/exercises/route.ts`
- Test: `src/__tests__/api/exercises.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/api/exercises.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

describe("POST /api/exercises", () => {
  it("returns 401 when not authenticated", async () => {
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
});

describe("GET /api/exercises", () => {
  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/exercises/route");
    const request = new NextRequest("http://localhost:3000/api/exercises");
    const result = await GET(request);
    expect(result.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/__tests__/api/exercises.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create the exercises API route**

Create `src/app/api/exercises/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const EXERCISE_TYPES = ["drill", "repetition", "translation_prompt", "fluency_booster"];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { type, targetLanguage, basedOnMistakeIds, content } = body;

  if (!type || !targetLanguage) {
    return NextResponse.json(
      { error: "Missing required fields: type, targetLanguage" },
      { status: 400 }
    );
  }

  if (!EXERCISE_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${EXERCISE_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  let mistakes: { id: string }[] = [];

  if (basedOnMistakeIds && basedOnMistakeIds.length > 0) {
    mistakes = basedOnMistakeIds.map((id: string) => ({ id }));
  } else {
    const recentMistakes = await db.mistake.findMany({
      where: {
        userId: session.user.id,
        targetLanguage,
      },
      orderBy: { occurrenceCount: "desc" },
      take: 3,
    });
    mistakes = recentMistakes.map((m) => ({ id: m.id }));
  }

  const exercise = await db.exercise.create({
    data: {
      userId: session.user.id,
      targetLanguage,
      type,
      content: content || `Practice ${type}: review your common mistakes in ${targetLanguage}`,
      basedOnMistakes: {
        connect: mistakes,
      },
    },
    include: {
      basedOnMistakes: {
        select: { id: true, original: true, corrected: true, type: true },
      },
    },
  });

  return NextResponse.json(exercise, { status: 201 });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetLanguage = searchParams.get("targetLanguage");
  const completed = searchParams.get("completed");

  const exercises = await db.exercise.findMany({
    where: {
      userId: session.user.id,
      ...(targetLanguage ? { targetLanguage } : {}),
      ...(completed !== null ? { completed: completed === "true" } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      basedOnMistakes: {
        select: { id: true, original: true, corrected: true },
      },
    },
  });

  return NextResponse.json({ exercises });
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- src/__tests__/api/exercises.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add exercises API with generation based on mistakes"
```

---

### Task 7: Progress API

**Files:**
- Create: `src/app/api/progress/route.ts`
- Test: `src/__tests__/api/progress.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/api/progress.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

describe("POST /api/progress", () => {
  it("returns 401 when not authenticated", async () => {
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
});

describe("GET /api/progress", () => {
  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/progress/route");
    const request = new NextRequest("http://localhost:3000/api/progress");
    const result = await GET(request);
    expect(result.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/__tests__/api/progress.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create the progress API route**

Create `src/app/api/progress/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sentencesSpoken, mistakesCount, correctionsAccepted, targetLanguage } = body;

  if (!targetLanguage) {
    return NextResponse.json(
      { error: "Missing required field: targetLanguage" },
      { status: 400 }
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const hadActivityYesterday = await db.progress.findFirst({
    where: {
      userId: session.user.id,
      targetLanguage,
      date: yesterday,
    },
  });

  const streakDays = hadActivityYesterday ? hadActivityYesterday.streakDays + 1 : 1;

  const progress = await db.progress.upsert({
    where: {
      userId_targetLanguage_date: {
        userId: session.user.id,
        targetLanguage,
        date: today,
      },
    },
    create: {
      userId: session.user.id,
      targetLanguage,
      date: today,
      sentencesSpoken: sentencesSpoken || 0,
      mistakesCount: mistakesCount || 0,
      correctionsAccepted: correctionsAccepted || 0,
      streakDays,
    },
    update: {
      sentencesSpoken: { increment: sentencesSpoken || 0 },
      mistakesCount: { increment: mistakesCount || 0 },
      correctionsAccepted: { increment: correctionsAccepted || 0 },
      streakDays,
    },
  });

  return NextResponse.json(progress);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetLanguage = searchParams.get("targetLanguage");
  const days = parseInt(searchParams.get("days") || "30", 10);

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const progress = await db.progress.findMany({
    where: {
      userId: session.user.id,
      ...(targetLanguage ? { targetLanguage } : {}),
      date: { gte: since },
    },
    orderBy: { date: "desc" },
  });

  const currentStreak = progress.length > 0 ? progress[0].streakDays : 0;

  const totals = progress.reduce(
    (acc, p) => ({
      sentencesSpoken: acc.sentencesSpoken + p.sentencesSpoken,
      mistakesCount: acc.mistakesCount + p.mistakesCount,
      correctionsAccepted: acc.correctionsAccepted + p.correctionsAccepted,
    }),
    { sentencesSpoken: 0, mistakesCount: 0, correctionsAccepted: 0 }
  );

  return NextResponse.json({
    progress,
    currentStreak,
    totals,
    daysTracked: progress.length,
  });
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- src/__tests__/api/progress.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add progress API with streak tracking and daily aggregation"
```

---

## Phase 3: Core UI

---

### Task 8: App Layout + Navbar + Auth Guard

**Files:**
- Create: `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/globals.css`, `src/components/Navbar.tsx`

- [ ] **Step 1: Update root layout**

Replace `src/app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EchoVocis — Learn Languages by Voice",
  description: "Improve your spoken fluency through real-time conversation with Emma, your AI voice coach.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Update globals.css**

Replace `src/app/globals.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 3: Create auth-protected layout**

Create `src/app/(app)/layout.tsx`:

```typescript
import { Navbar } from "@/components/Navbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Create Navbar component**

Create `src/components/Navbar.tsx`:

```typescript
import { auth, signOut } from "@/lib/auth";
import Link from "next/link";

export async function Navbar() {
  const session = await auth();

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
      <Link href="/practice" className="text-lg font-bold text-gray-900">
        EchoVocis
      </Link>

      {session?.user && (
        <div className="flex items-center gap-4">
          <Link href="/exercises" className="text-sm text-gray-600 hover:text-gray-900">
            Exercises
          </Link>
          <Link href="/progress" className="text-sm text-gray-600 hover:text-gray-900">
            Progress
          </Link>
          <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
            Settings
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-900">
              Sign out
            </button>
          </form>
        </div>
      )}
    </nav>
  );
}
```

- [ ] **Step 5: Verify the app runs**

```bash
npm run dev
```

Expected: App starts on `http://localhost:3000` without errors.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add app layout with Navbar and auth-protected route group"
```

---

### Task 9: Landing Page

**Files:**
- Create: `src/app/page.tsx`

- [ ] **Step 1: Create landing page**

Replace `src/app/page.tsx`:

```typescript
import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function LandingPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-blue-50 px-4">
      <div className="max-w-lg text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900">
          EchoVocis
        </h1>
        <p className="mb-2 text-xl text-gray-600">
          Learn languages by talking with Emma
        </p>
        <p className="mb-8 text-gray-500">
          A voice-first AI coach that helps you improve spoken fluency through
          real-time conversation, corrections, and personalized exercises.
        </p>

        {session?.user ? (
          <Link
            href="/practice"
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Talk with Emma
          </Link>
        ) : (
          <Link
            href="/login"
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Get started
          </Link>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify landing page renders**

```bash
npm run dev
```

Navigate to `http://localhost:3000`. Expected: Landing page with title, description, and CTA button.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add landing page with auth-aware CTA"
```

---

### Task 10: Login Page

**Files:**
- Create: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create login page**

Create `src/app/(auth)/login/page.tsx`:

```typescript
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getServerSession();

  if (session) {
    redirect("/practice");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          Welcome to EchoVocis
        </h1>
        <p className="mb-8 text-center text-gray-500">
          Sign in to start practicing
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/practice" });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify login page renders**

Navigate to `http://localhost:3000/login`. Expected: Login page with Google sign-in button.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add login page with Google OAuth button"
```

---

### Task 11: Onboarding Page

**Files:**
- Create: `src/app/(app)/onboarding/page.tsx`, `src/components/LanguageFlag.tsx`
- Modify: `src/app/(app)/onboarding/` (create directory)

- [ ] **Step 1: Create LanguageFlag helper**

Create `src/components/LanguageFlag.tsx`:

```typescript
const LANGUAGE_FLAGS: Record<string, string> = {
  en: "\u{1F1EC}\u{1F1E7}",
  it: "\u{1F1EE}\u{1F1F9}",
  fr: "\u{1F1EB}\u{1F1F7}",
  de: "\u{1F1E9}\u{1F1EA}",
  es: "\u{1F1EA}\u{1F1F8}",
  pt: "\u{1F1F5}\u{1F1F9}",
  ja: "\u{1F1EF}\u{1F1F5}",
  ko: "\u{1F1F0}\u{1F1F7}",
  zh: "\u{1F1E8}\u{1F1F3}",
  ru: "\u{1F1F7}\u{1F1FA}",
  hi: "\u{1F1EE}\u{1F1F3}",
  ar: "\u{1F1E6}\u{1F1EA}",
  tr: "\u{1F1F9}\u{1F1F7}",
  id: "\u{1F1EE}\u{1F1E9}",
  vi: "\u{1F1FB}\u{1F1F3}",
  bn: "\u{1F1E7}\u{1F1F9}",
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  it: "Italian",
  fr: "French",
  de: "German",
  es: "Spanish",
  pt: "Portuguese",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ru: "Russian",
  hi: "Hindi",
  ar: "Arabic",
  tr: "Turkish",
  id: "Indonesian",
  vi: "Vietnamese",
  bn: "Bengali",
};

export function LanguageFlag({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span>{LANGUAGE_FLAGS[code] || "\u{1F310}"}</span>
      <span>{LANGUAGE_NAMES[code] || code}</span>
    </span>
  );
}

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_NAMES);
```

- [ ] **Step 2: Create onboarding page**

Create `src/app/(app)/onboarding/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LanguageFlag, SUPPORTED_LANGUAGES } from "@/components/LanguageFlag";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (user?.onboardingCompleted) {
    redirect("/practice");
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          Welcome to EchoVocis!
        </h1>
        <p className="mb-8 text-center text-gray-500">
          Choose your languages to get started
        </p>

        <form className="space-y-6" action={async (formData: FormData) => {
          "use server";
          const session = await auth();
          if (!session?.user?.id) return;

          const nativeLanguage = formData.get("nativeLanguage") as string;
          const targetLanguage = formData.get("targetLanguage") as string;

          await db.user.update({
            where: { id: session.user.id },
            data: {
              nativeLanguage,
              targetLanguage,
              onboardingCompleted: true,
            },
          });

          redirect("/practice");
        }}>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              I speak
            </label>
            <select
              name="nativeLanguage"
              defaultValue="it"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {SUPPORTED_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {new Intl.DisplayNames(["en"], { type: "language" }).of(code)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              I want to learn
            </label>
            <select
              name="targetLanguage"
              defaultValue="en"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {SUPPORTED_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {new Intl.DisplayNames(["en"], { type: "language" }).of(code)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Start learning
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add onboarding page with native/target language selection"
```

---

### Task 12: Settings Page

**Files:**
- Create: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Create settings page**

Create `src/app/(app)/settings/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LanguageFlag, SUPPORTED_LANGUAGES } from "@/components/LanguageFlag";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Settings</h1>

      <form
        className="space-y-6"
        action={async (formData: FormData) => {
          "use server";
          const session = await auth();
          if (!session?.user?.id) return;

          const nativeLanguage = formData.get("nativeLanguage") as string;
          const targetLanguage = formData.get("targetLanguage") as string;

          await db.user.update({
            where: { id: session.user.id },
            data: { nativeLanguage, targetLanguage },
          });

          redirect("/settings");
        }}
      >
        <div className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-4 text-lg font-medium text-gray-900">Languages</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Native language
              </label>
              <select
                name="nativeLanguage"
                defaultValue={user.nativeLanguage}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {SUPPORTED_LANGUAGES.map((code) => (
                  <option key={code} value={code}>
                    {new Intl.DisplayNames(["en"], { type: "language" }).of(code)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Target language
              </label>
              <select
                name="targetLanguage"
                defaultValue={user.targetLanguage}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {SUPPORTED_LANGUAGES.map((code) => (
                  <option key={code} value={code}>
                    {new Intl.DisplayNames(["en"], { type: "language" }).of(code)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-2 text-lg font-medium text-gray-900">Profile</h2>
          <p className="text-sm text-gray-500">
            {user.name || "No name set"} &middot; {user.email}
          </p>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          Save changes
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add settings page with language and profile display"
```

---

## Phase 4: Voice Engine

---

### Task 13: System Prompt Builder

**Files:**
- Create: `src/lib/grok/prompt.ts`
- Test: `src/__tests__/lib/grok/prompt.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/lib/grok/prompt.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/grok/prompt";

describe("buildSystemPrompt", () => {
  it("fills in language placeholders", () => {
    const prompt = buildSystemPrompt({
      nativeLanguage: "it",
      targetLanguage: "en",
      recentMistakes: [],
      sessionCount: 0,
    });

    expect(prompt).toContain("Italian");
    expect(prompt).toContain("English");
    expect(prompt).not.toContain("{nativeLanguage}");
    expect(prompt).not.toContain("{targetLanguage}");
  });

  it("includes recent mistakes when provided", () => {
    const prompt = buildSystemPrompt({
      nativeLanguage: "it",
      targetLanguage: "en",
      recentMistakes: [
        { original: "I goed", corrected: "I went", type: "grammar" },
        { original: "she speak", corrected: "she speaks", type: "grammar" },
      ],
      sessionCount: 5,
    });

    expect(prompt).toContain("I goed");
    expect(prompt).toContain("I went");
    expect(prompt).toContain("5");
  });

  it("shows no mistakes message when list is empty", () => {
    const prompt = buildSystemPrompt({
      nativeLanguage: "it",
      targetLanguage: "en",
      recentMistakes: [],
      sessionCount: 0,
    });

    expect(prompt).toContain("No previous mistakes recorded");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/__tests__/lib/grok/prompt.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create the prompt builder**

Create `src/lib/grok/prompt.ts`:

```typescript
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  it: "Italian",
  fr: "French",
  de: "German",
  es: "Spanish",
  pt: "Portuguese",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ru: "Russian",
  hi: "Hindi",
  ar: "Arabic",
  tr: "Turkish",
  id: "Indonesian",
  vi: "Vietnamese",
  bn: "Bengali",
};

function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code;
}

interface MistakeSummary {
  original: string;
  corrected: string;
  type: string;
}

interface PromptParams {
  nativeLanguage: string;
  targetLanguage: string;
  recentMistakes: MistakeSummary[];
  sessionCount: number;
}

export function buildSystemPrompt(params: PromptParams): string {
  const native = getLanguageName(params.nativeLanguage);
  const target = getLanguageName(params.targetLanguage);

  const mistakesSection =
    params.recentMistakes.length > 0
      ? params.recentMistakes
          .map(
            (m) =>
              `- "${m.original}" → "${m.corrected}" (${m.type})`
          )
          .join("\n")
      : "No previous mistakes recorded yet.";

  return `You are Emma, a voice-based language fluency coach for the EchoVocis app.

Your goal is to help the user speak ${target} more fluently and naturally through real conversation.

USER CONTEXT:
- Native language: ${native}
- Target language: ${target}
- Recurring mistakes:
${mistakesSection}
- Sessions completed: ${params.sessionCount}

CORE BEHAVIOR:
- If the user speaks in ${target}: listen, identify mistakes or unnatural phrasing, then repeat the sentence in a corrected and more natural version. Briefly explain the correction.
- If the user speaks in ${native}: translate the sentence into ${target}, offer a more natural version if possible, and encourage the user to repeat it aloud.
- If the user mixes both languages in one sentence, translate the ${native} portion into ${target} and correct the ${target} portion. Present the full corrected sentence.

CLARIFICATION:
- If the user asks to repeat or clarify something in ${native} (e.g. "non ho capito", "puoi ripetere?"), explain again in ${native}.
- If the user asks to repeat or clarify something in ${target} (e.g. "I don't understand", "can you repeat please?"), explain again in ${target}.
- Always match the language the user uses to ask for help.

COMMUNICATION STYLE:
- Short and natural. Never deliver long monologues.
- Correct with warmth, never with judgment.
- Use simple language, not academic terms.
- Focus on naturalness over grammatical perfection.
- Always encourage repetition.

TONE EXAMPLES:
- "Almost perfect! Try saying: [corrected version]"
- "Good! A more natural version would be: [version]"
- "Say it after me: [sentence]"
- "You're improving! Let's work on this weak point."
- "That was clear and natural. Keep going!"

MEMORY TOOLS:
- When you identify a significant mistake, use save_mistake to save it.
- When the user asks for exercises, use generate_exercise to create one based on their mistakes.
- Use get_user_history to check the user's progress when needed.

RULES:
- Do not give grammar lectures. Correct and move on.
- Never be verbose. Brief response, then let the user speak.
- If the user says something correct and natural, confirm briefly and encourage them to continue.
- Speak in ${target} by default, except when explaining a correction to a beginner or when the user asks for clarification in ${native}.`;
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- src/__tests__/lib/grok/prompt.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Emma system prompt builder with dynamic placeholders"
```

---

### Task 14: Grok Tools Schema

**Files:**
- Create: `src/lib/grok/tools.ts`
- Test: `src/__tests__/lib/grok/tools.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/lib/grok/tools.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/__tests__/lib/grok/tools.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create the tools schema**

Create `src/lib/grok/tools.ts`:

```typescript
export interface GrokTool {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const KNOWN_FUNCTIONS = new Set([
  "save_mistake",
  "get_user_history",
  "generate_exercise",
  "save_progress",
]);

export function isKnownFunction(name: string): boolean {
  return KNOWN_FUNCTIONS.has(name);
}

export const GROK_TOOLS: GrokTool[] = [
  {
    type: "function",
    name: "save_mistake",
    description:
      "Save a language mistake identified during conversation. Call this when you correct a significant error in the user's speech — grammar mistakes, wrong word choices, or unnatural phrasing. Do not save minor pronunciation variations.",
    parameters: {
      type: "object",
      properties: {
        original: {
          type: "string",
          description: "What the user actually said (their version)",
        },
        corrected: {
          type: "string",
          description: "The corrected, natural version",
        },
        type: {
          type: "string",
          enum: ["grammar", "vocabulary", "pronunciation", "fluency"],
          description: "Category of the mistake",
        },
        targetLanguage: {
          type: "string",
          description: "ISO language code of the target language (e.g. 'en', 'it')",
        },
      },
      required: ["original", "corrected", "type", "targetLanguage"],
    },
  },
  {
    type: "function",
    name: "get_user_history",
    description:
      "Retrieve the user's recent mistakes and recurring patterns. Call this at the start of a session or when you want to check what the user has been struggling with, to personalize your coaching.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Max number of recent mistakes to return (default 10, max 50)",
        },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "generate_exercise",
    description:
      "Create a personalized exercise based on the user's past mistakes. Call this when the user asks for practice or when you want to reinforce a weak point you've noticed.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["drill", "repetition", "translation_prompt", "fluency_booster"],
          description: "Type of exercise to generate",
        },
        basedOnMistakeIds: {
          type: "array",
          items: { type: "string" },
          description:
            "IDs of mistakes to base the exercise on. If empty, the backend selects the most recent recurring mistakes.",
        },
      },
      required: ["type"],
    },
  },
  {
    type: "function",
    name: "save_progress",
    description:
      "Update the user's session progress counters. Call this periodically during conversation (roughly every few exchanges) to track how much the user has spoken and how many mistakes were made.",
    parameters: {
      type: "object",
      properties: {
        sentencesSpoken: {
          type: "integer",
          description: "Number of sentences the user has spoken so far this session",
        },
        mistakesCount: {
          type: "integer",
          description: "Number of mistakes identified so far this session",
        },
        correctionsAccepted: {
          type: "integer",
          description:
            "Number of times the user repeated the corrected version",
        },
        targetLanguage: {
          type: "string",
          description: "ISO language code of the target language (e.g. 'en', 'it')",
        },
      },
      required: ["sentencesSpoken", "mistakesCount", "correctionsAccepted", "targetLanguage"],
    },
  },
];
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- src/__tests__/lib/grok/tools.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Grok Voice Agent custom function tool schemas"
```

---

### Task 15: Audio Pipeline Helpers

**Files:**
- Create: `src/lib/grok/audio.ts`
- Test: `src/__tests__/lib/grok/audio.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/lib/grok/audio.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/__tests__/lib/grok/audio.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create audio pipeline helpers**

Create `src/lib/grok/audio.ts`:

```typescript
export const SAMPLE_RATE = 24000;

export function float32ToBase64PCM16(float32Array: Float32Array): string {
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64PCM16ToFloat32(base64String: string): Float32Array {
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const pcm16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768.0;
  }
  return float32;
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- src/__tests__/lib/grok/audio.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add audio pipeline helpers for PCM16 conversion"
```

---

### Task 16: WebSocket Client

**Files:**
- Create: `src/lib/grok/client.ts`

This is a browser-only module (no server-side tests). It manages the WebSocket connection to Grok Voice Agent, handles events, and routes function calls.

- [ ] **Step 1: Create the WebSocket client**

Create `src/lib/grok/client.ts`:

```typescript
import { GROK_TOOLS } from "./tools";
import { float32ToBase64PCM16, base64PCM16ToFloat32, SAMPLE_RATE } from "./audio";
import { buildSystemPrompt } from "./prompt";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface VoiceClientConfig {
  ephemeralToken: string;
  nativeLanguage: string;
  targetLanguage: string;
  recentMistakes: { original: string; corrected: string; type: string }[];
  sessionCount: number;
  sessionId: string;
  onStatusChange: (status: ConnectionStatus) => void;
  onUserTranscript: (text: string) => void;
  onEmmaText: (text: string) => void;
  onEmmaAudio: (float32: Float32Array) => void;
  onCorrection: (original: string, corrected: string, type: string) => void;
  onFunctionCall: (
    name: string,
    args: Record<string, unknown>,
    callId: string
  ) => Promise<string>;
}

export class VoiceClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private earlyAudioBuffer: string[] = [];
  private config: VoiceClientConfig;
  private pendingFunctionCalls: Map<string, { name: string; args: string }> = new Map();
  private emmaTextBuffer = "";
  private currentPlaybackSource: AudioBufferSourceNode | null = null;
  private playbackQueue: Float32Array[] = [];
  private isPlaying = false;
  private playbackSampleOffset = 0;

  constructor(config: VoiceClientConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.config.onStatusChange("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;

      this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = this.audioContext.createMediaStreamSource(stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const base64 = float32ToBase64PCM16(new Float32Array(input));
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: base64,
            })
          );
        } else {
          this.earlyAudioBuffer.push(base64);
        }
      };
    } catch (err) {
      this.config.onStatusChange("error");
      throw new Error(
        `Microphone access denied: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }

    const wsUrl = "wss://api.x.ai/v1/realtime?model=grok-voice-latest";
    this.ws = new WebSocket(wsUrl, [
      `xai-client-secret.${this.config.ephemeralToken}`,
    ]);

    this.ws.onopen = () => {
      this.sendSessionUpdate();

      for (const audio of this.earlyAudioBuffer) {
        this.ws!.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio,
          })
        );
      }
      this.earlyAudioBuffer = [];

      this.config.onStatusChange("connected");
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };

    this.ws.onerror = () => {
      this.config.onStatusChange("error");
    };

    this.ws.onclose = () => {
      this.config.onStatusChange("disconnected");
    };
  }

  private sendSessionUpdate(): void {
    const instructions = buildSystemPrompt({
      nativeLanguage: this.config.nativeLanguage,
      targetLanguage: this.config.targetLanguage,
      recentMistakes: this.config.recentMistakes,
      sessionCount: this.config.sessionCount,
    });

    this.ws!.send(
      JSON.stringify({
        type: "session.update",
        session: {
          voice: "ara",
          instructions,
          turn_detection: {
            type: "server_vad",
            silence_duration_ms: 1500,
          },
          tools: GROK_TOOLS,
        },
      })
    );
  }

  private async handleMessage(event: Record<string, unknown>): Promise<void> {
    const type = event.type as string;

    switch (type) {
      case "response.output_audio.delta": {
        const delta = event.delta as string;
        const float32 = base64PCM16ToFloat32(delta);
        this.config.onEmmaAudio(float32);
        break;
      }

      case "response.text.delta": {
        const delta = event.delta as string;
        this.emmaTextBuffer += delta;
        this.config.onEmmaText(this.emmaTextBuffer);
        break;
      }

      case "response.done": {
        this.emmaTextBuffer = "";
        break;
      }

      case "conversation.item.input_audio_transcription.completed": {
        const transcript = event.transcript as string;
        if (transcript) {
          this.config.onUserTranscript(transcript);
        }
        break;
      }

      case "response.function_call_arguments.done": {
        const callId = event.call_id as string;
        const name = event.name as string;
        const argumentsStr = event.arguments as string;

        try {
          const args = JSON.parse(argumentsStr);
          const result = await this.config.onFunctionCall(name, args, callId);
          this.sendFunctionResult(callId, result);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          this.sendFunctionResult(callId, JSON.stringify({ error: errorMsg }));
        }
        break;
      }
    }
  }

  private sendFunctionResult(callId: string, output: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output,
        },
      })
    );

    this.ws.send(JSON.stringify({ type: "response.create" }));
  }

  disconnect(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.earlyAudioBuffer = [];
    this.config.onStatusChange("disconnected");
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add Grok Voice Agent WebSocket client with audio pipeline"
```

---

### Task 17: Voice UI Components

**Files:**
- Create: `src/components/voice/VoiceButton.tsx`, `src/components/voice/TranscriptPanel.tsx`, `src/components/voice/CorrectionCard.tsx`

- [ ] **Step 1: Create VoiceButton component**

Create `src/components/voice/VoiceButton.tsx`:

```typescript
"use client";

import { ConnectionStatus } from "@/lib/grok/client";

interface VoiceButtonProps {
  status: ConnectionStatus;
  onStart: () => void;
  onStop: () => void;
}

export function VoiceButton({ status, onStart, onStop }: VoiceButtonProps) {
  const isActive = status === "connected";
  const isConnecting = status === "connecting";
  const isDisconnected = status === "disconnected" || status === "error";

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={isActive ? onStop : onStart}
        disabled={isConnecting}
        className={`flex h-20 w-20 items-center justify-center rounded-full transition-all ${
          isActive
            ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200 animate-pulse"
            : isConnecting
            ? "bg-gray-400 cursor-wait"
            : "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
        }`}
      >
        {isActive ? (
          <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
            />
          </svg>
        )}
      </button>

      <span className="text-sm text-gray-500">
        {isActive ? "Tap to stop" : isConnecting ? "Connecting..." : "Tap to speak"}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create CorrectionCard component**

Create `src/components/voice/CorrectionCard.tsx`:

```typescript
"use client";

interface CorrectionCardProps {
  original: string;
  corrected: string;
  type: string;
}

export function CorrectionCard({ original, corrected, type }: CorrectionCardProps) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-blue-600">
        {type}
      </div>

      <div className="mb-2">
        <span className="text-sm text-gray-500">You: </span>
        <span className="text-sm text-gray-400 line-through">{original}</span>
      </div>

      <div className="mb-3">
        <span className="text-sm text-gray-500">Correct: </span>
        <span className="text-sm font-medium text-gray-900">{corrected}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create TranscriptPanel component**

Create `src/components/voice/TranscriptPanel.tsx`:

```typescript
"use client";

import { CorrectionCard } from "./CorrectionCard";

export interface TranscriptEntry {
  id: string;
  role: "user" | "emma";
  text: string;
  correction?: {
    original: string;
    corrected: string;
    type: string;
  };
}

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
  isEmmaSpeaking: boolean;
}

export function TranscriptPanel({ entries, isEmmaSpeaking }: TranscriptPanelProps) {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto px-4 py-4">
      {entries.length === 0 && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <p className="text-sm">Start speaking to see the transcript here</p>
        </div>
      )}

      {entries.map((entry) => (
        <div key={entry.id}>
          {entry.role === "user" ? (
            <div className="rounded-lg bg-gray-50 px-4 py-2">
              <span className="text-xs font-medium text-gray-400">You</span>
              <p className="text-sm text-gray-700">{entry.text}</p>
            </div>
          ) : (
            <div>
              <div className="rounded-lg bg-white border border-gray-100 px-4 py-2">
                <span className="text-xs font-medium text-blue-500">Emma</span>
                <p className="text-sm text-gray-900">{entry.text}</p>
              </div>
              {entry.correction && (
                <div className="mt-2">
                  <CorrectionCard
                    original={entry.correction.original}
                    corrected={entry.correction.corrected}
                    type={entry.correction.type}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {isEmmaSpeaking && (
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: "0ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: "150ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-xs text-gray-400">Emma is speaking</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add VoiceButton, TranscriptPanel, and CorrectionCard components"
```

---

### Task 18: VoiceConversation Orchestrator

**Files:**
- Create: `src/components/voice/VoiceConversation.tsx`

This is the main client component that wires the VoiceClient to the UI components and handles function call routing to backend APIs.

- [ ] **Step 1: Create VoiceConversation component**

Create `src/components/voice/VoiceConversation.tsx`:

```typescript
"use client";

import { useCallback, useRef, useState } from "react";
import { VoiceClient, ConnectionStatus } from "@/lib/grok/client";
import { VoiceButton } from "./VoiceButton";
import { TranscriptPanel, TranscriptEntry } from "./TranscriptPanel";
import { isKnownFunction } from "@/lib/grok/tools";

interface VoiceConversationProps {
  nativeLanguage: string;
  targetLanguage: string;
  recentMistakes: { original: string; corrected: string; type: string }[];
  sessionCount: number;
}

export function VoiceConversation({
  nativeLanguage,
  targetLanguage,
  recentMistakes,
  sessionCount,
}: VoiceConversationProps) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [isEmmaSpeaking, setIsEmmaSpeaking] = useState(false);
  const clientRef = useRef<VoiceClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const currentEmmaTextRef = useRef("");

  const handleFunctionCall = useCallback(
    async (
      name: string,
      args: Record<string, unknown>,
      _callId: string
    ): Promise<string> => {
      if (!isKnownFunction(name)) {
        return JSON.stringify({ error: `Unknown function: ${name}` });
      }

      try {
        let endpoint = "";
        let body: Record<string, unknown>;

        switch (name) {
          case "save_mistake": {
            endpoint = "/api/memory";
            body = {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(args),
            };
            const res = await fetch(endpoint, body);
            const data = await res.json();
            return JSON.stringify(data);
          }

          case "get_user_history": {
            const limit = (args.limit as number) || 10;
            const res = await fetch(`/api/memory?limit=${limit}&targetLanguage=${targetLanguage}`);
            const data = await res.json();
            return JSON.stringify(data);
          }

          case "generate_exercise": {
            endpoint = "/api/exercises";
            body = {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...args, targetLanguage }),
            };
            const res = await fetch(endpoint, body);
            const data = await res.json();
            return JSON.stringify(data);
          }

          case "save_progress": {
            endpoint = "/api/progress";
            body = {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(args),
            };
            const res = await fetch(endpoint, body);
            const data = await res.json();
            return JSON.stringify(data);
          }

          default:
            return JSON.stringify({ error: "Unhandled function" });
        }
      } catch (err) {
        return JSON.stringify({
          error: err instanceof Error ? err.message : "Request failed",
        });
      }
    },
    [targetLanguage]
  );

  const handleEmmaAudio = useCallback((float32: Float32Array) => {
    setIsEmmaSpeaking(true);

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }

    playbackQueueRef.current.push(float32);

    if (!isPlayingRef.current) {
      playNextChunk();
    }
  }, []);

  const playNextChunk = useCallback(() => {
    if (playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsEmmaSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    const chunk = playbackQueueRef.current.shift()!;
    const ctx = audioContextRef.current!;

    const buffer = ctx.createBuffer(1, chunk.length, 24000);
    buffer.getChannelData(0).set(chunk);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      playNextChunk();
    };
    source.start();
  }, []);

  const handleStart = useCallback(async () => {
    try {
      const tokenRes = await fetch("/api/session", { method: "POST" });
      if (!tokenRes.ok) {
        console.error("Failed to get ephemeral token");
        return;
      }
      const tokenData = await tokenRes.json();
      const ephemeralToken = tokenData.client_secret?.value;
      if (!ephemeralToken) {
        console.error("No token in response");
        return;
      }

      const client = new VoiceClient({
        ephemeralToken,
        nativeLanguage,
        targetLanguage,
        recentMistakes,
        sessionCount,
        sessionId: "",
        onStatusChange: setStatus,
        onUserTranscript: (text) => {
          setEntries((prev) => [
            ...prev,
            {
              id: `user-${Date.now()}`,
              role: "user",
              text,
            },
          ]);
        },
        onEmmaText: (text) => {
          currentEmmaTextRef.current = text;
        },
        onEmmaAudio: handleEmmaAudio,
        onCorrection: (original, corrected, type) => {
          setEntries((prev) => {
            const lastEmma = [...prev]
              .reverse()
              .find((e) => e.role === "emma");
            if (lastEmma) {
              return prev.map((e) =>
                e.id === lastEmma.id
                  ? { ...e, correction: { original, corrected, type } }
                  : e
              );
            }
            return prev;
          });
        },
        onFunctionCall: handleFunctionCall,
      });

      clientRef.current = client;
      await client.connect();
    } catch (err) {
      console.error("Failed to start session:", err);
      setStatus("error");
    }
  }, [nativeLanguage, targetLanguage, recentMistakes, sessionCount, handleEmmaAudio, handleFunctionCall]);

  const handleStop = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    setIsEmmaSpeaking(false);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <TranscriptPanel entries={entries} isEmmaSpeaking={isEmmaSpeaking && entries.length > 0} />
      </div>

      <div className="flex items-center justify-center gap-8 border-t border-gray-100 bg-white px-4 py-6">
        <VoiceButton status={status} onStart={handleStart} onStop={handleStop} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add VoiceConversation orchestrator component with function routing"
```

---

### Task 19: Practice Page

**Files:**
- Create: `src/app/(app)/practice/page.tsx`

- [ ] **Step 1: Create practice page**

Create `src/app/(app)/practice/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { VoiceConversation } from "@/components/voice/VoiceConversation";

export default async function PracticePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.onboardingCompleted) {
    redirect("/onboarding");
  }

  const sessionCount = await db.session.count({
    where: { userId: user.id },
  });

  const recentMistakes = await db.mistake.findMany({
    where: {
      userId: user.id,
      targetLanguage: user.targetLanguage,
    },
    orderBy: { lastSeenAt: "desc" },
    take: 10,
    select: {
      original: true,
      corrected: true,
      type: true,
    },
  });

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <h2 className="text-sm font-medium text-gray-600">
          Practice: {user.targetLanguage.toUpperCase()}
        </h2>
        <span className="text-xs text-gray-400">
          {recentMistakes.length > 0
            ? `${recentMistakes.length} recent mistakes loaded`
            : "No previous mistakes"}
        </span>
      </div>

      <VoiceConversation
        nativeLanguage={user.nativeLanguage}
        targetLanguage={user.targetLanguage}
        recentMistakes={recentMistakes}
        sessionCount={sessionCount}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify the practice page compiles**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add practice page — main voice conversation with Emma"
```

---

## Phase 5: Feature Pages

---

### Task 20: Exercises Page

**Files:**
- Create: `src/app/(app)/exercises/page.tsx`

- [ ] **Step 1: Create exercises page**

Create `src/app/(app)/exercises/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function ExercisesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    redirect("/login");
  }

  const exercises = await db.exercise.findMany({
    where: {
      userId: user.id,
      ...(user.targetLanguage ? { targetLanguage: user.targetLanguage } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      basedOnMistakes: {
        select: { id: true, original: true, corrected: true },
      },
    },
  });

  const pendingCount = exercises.filter((e) => !e.completed).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Exercises</h1>
        <span className="text-sm text-gray-500">
          {pendingCount} pending
        </span>
      </div>

      {exercises.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 py-12 text-center">
          <p className="text-gray-500">No exercises yet.</p>
          <p className="mt-1 text-sm text-gray-400">
            Talk with Emma and she&apos;ll create exercises based on your mistakes.
          </p>
          <Link
            href="/practice"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Start practicing
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {exercises.map((exercise) => (
            <div
              key={exercise.id}
              className={`rounded-lg border p-4 ${
                exercise.completed
                  ? "border-green-200 bg-green-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium uppercase tracking-wide ${
                    exercise.completed ? "text-green-600" : "text-blue-600"
                  }`}
                >
                  {exercise.type}
                </span>
                {exercise.completed && (
                  <span className="text-xs text-green-600">Completed</span>
                )}
              </div>

              <p className="mt-2 text-sm text-gray-700">{exercise.content}</p>

              {exercise.basedOnMistakes.length > 0 && (
                <div className="mt-2 text-xs text-gray-400">
                  Based on:{" "}
                  {exercise.basedOnMistakes
                    .map((m) => `"${m.original}" → "${m.corrected}"`)
                    .join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add exercises page with pending/completed display"
```

---

### Task 21: Progress Page

**Files:**
- Create: `src/app/(app)/progress/page.tsx`

- [ ] **Step 1: Create progress page**

Create `src/app/(app)/progress/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function ProgressPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    redirect("/login");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const progress = await db.progress.findMany({
    where: {
      userId: user.id,
      targetLanguage: user.targetLanguage,
      date: { gte: thirtyDaysAgo },
    },
    orderBy: { date: "desc" },
  });

  const currentStreak = progress.length > 0 ? progress[0].streakDays : 0;

  const totals = progress.reduce(
    (acc, p) => ({
      sentencesSpoken: acc.sentencesSpoken + p.sentencesSpoken,
      mistakesCount: acc.mistakesCount + p.mistakesCount,
      correctionsAccepted: acc.correctionsAccepted + p.correctionsAccepted,
    }),
    { sentencesSpoken: 0, mistakesCount: 0, correctionsAccepted: 0 }
  );

  const totalSessions = await db.session.count({
    where: { userId: user.id },
  });

  const totalMistakes = await db.mistake.count({
    where: { userId: user.id, targetLanguage: user.targetLanguage },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Progress</h1>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <div className="text-3xl font-bold text-orange-500">{currentStreak}</div>
          <div className="text-sm text-gray-500">Day streak</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{totalSessions}</div>
          <div className="text-sm text-gray-500">Sessions</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{totals.sentencesSpoken}</div>
          <div className="text-sm text-gray-500">Sentences spoken (30d)</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <div className="text-3xl font-bold text-purple-600">{totalMistakes}</div>
          <div className="text-sm text-gray-500">Mistakes tracked</div>
        </div>
      </div>

      {progress.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 py-12 text-center">
          <p className="text-gray-500">No activity yet.</p>
          <p className="mt-1 text-sm text-gray-400">
            Start a conversation with Emma to see your progress.
          </p>
          <Link
            href="/practice"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Start practicing
          </Link>
        </div>
      ) : (
        <div>
          <h2 className="mb-3 text-lg font-medium text-gray-900">Last 30 days</h2>
          <div className="space-y-2">
            {progress.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3"
              >
                <span className="text-sm text-gray-600">
                  {p.date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>{p.sentencesSpoken} sentences</span>
                  <span>{p.mistakesCount} mistakes</span>
                  <span>{p.correctionsAccepted} corrections</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add progress page with streak, stats, and daily breakdown"
```

---

## Phase 6: Polish

---

### Task 22: Error Handling + Loading States + Navbar Enhancement

**Files:**
- Modify: `src/components/voice/VoiceConversation.tsx`, `src/components/Navbar.tsx`

- [ ] **Step 1: Add error handling and loading toast to VoiceConversation**

Update `src/components/voice/VoiceConversation.tsx` — add an error state and retry logic. Add these state variables inside the component:

```typescript
const [error, setError] = useState<string | null>(null);
const [isLoadingToken, setIsLoadingToken] = useState(false);
```

Wrap the `handleStart` fetch calls with error handling. Replace the try/catch in `handleStart`:

```typescript
const handleStart = useCallback(async () => {
  setError(null);
  setIsLoadingToken(true);
  try {
    let tokenRes: Response;
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      tokenRes = await fetch("/api/session", { method: "POST" });
      if (tokenRes.ok) break;
      retries++;
      if (retries >= maxRetries) {
        setError("Failed to connect. Please try again.");
        setIsLoadingToken(false);
        return;
      }
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retries)));
    }

    const tokenData = await tokenRes!.json();
    const ephemeralToken = tokenData.client_secret?.value;
    if (!ephemeralToken) {
      setError("Invalid session token.");
      setIsLoadingToken(false);
      return;
    }

    const client = new VoiceClient({
      ephemeralToken,
      nativeLanguage,
      targetLanguage,
      recentMistakes,
      sessionCount,
      sessionId: "",
      onStatusChange: (s) => {
        setStatus(s);
        setIsLoadingToken(false);
        if (s === "error") {
          setError("Connection lost. Tap to reconnect.");
        }
      },
      onUserTranscript: (text) => {
        setEntries((prev) => [
          ...prev,
          { id: `user-${Date.now()}`, role: "user", text },
        ]);
      },
      onEmmaText: (text) => {
        currentEmmaTextRef.current = text;
      },
      onEmmaAudio: handleEmmaAudio,
      onCorrection: (original, corrected, type) => {
        setEntries((prev) => {
          const lastEmma = [...prev].reverse().find((e) => e.role === "emma");
          if (lastEmma) {
            return prev.map((e) =>
              e.id === lastEmma.id
                ? { ...e, correction: { original, corrected, type } }
                : e
            );
          }
          return prev;
        });
      },
      onFunctionCall: handleFunctionCall,
    });

    clientRef.current = client;
    await client.connect();
  } catch (err) {
    setError(err instanceof Error ? err.message : "Something went wrong");
    setIsLoadingToken(false);
  }
}, [nativeLanguage, targetLanguage, recentMistakes, sessionCount, handleEmmaAudio, handleFunctionCall]);
```

Add error display in the JSX, before the VoiceButton:

```typescript
{error && (
  <div className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
    {error}
    <button
      onClick={() => setError(null)}
      className="ml-2 text-red-500 underline"
    >
      Dismiss
    </button>
  </div>
)}
```

Update the VoiceButton props to include loading state:

```typescript
<VoiceButton
  status={isLoadingToken ? "connecting" : status}
  onStart={handleStart}
  onStop={handleStop}
/>
```

- [ ] **Step 2: Update Navbar with language display**

Replace `src/components/Navbar.tsx`:

```typescript
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export async function Navbar() {
  const session = await auth();

  let languageLabel = "";
  if (session?.user?.id) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { nativeLanguage: true, targetLanguage: true, onboardingCompleted: true },
    });
    if (user?.onboardingCompleted) {
      languageLabel = `${user.nativeLanguage.toUpperCase()} \u2192 ${user.targetLanguage.toUpperCase()}`;
    }
  }

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <Link href="/practice" className="text-lg font-bold text-gray-900">
          EchoVocis
        </Link>
        {languageLabel && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {languageLabel}
          </span>
        )}
      </div>

      {session?.user && (
        <div className="flex items-center gap-4">
          <Link href="/exercises" className="text-sm text-gray-600 hover:text-gray-900">
            Exercises
          </Link>
          <Link href="/progress" className="text-sm text-gray-600 hover:text-gray-900">
            Progress
          </Link>
          <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
            Settings
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-900">
              Sign out
            </button>
          </form>
        </div>
      )}
    </nav>
  );
}
```

- [ ] **Step 3: Verify build succeeds**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add error handling, retry logic, loading states, and navbar language display"
```

---

## Self-Review

**1. Spec Coverage Check:**

| Spec Section | Task |
|---|---|
| Product Summary (voice-first, Emma) | Tasks 16-19 |
| Key Decisions (stack, auth, voice) | Tasks 1-3, 16 |
| Architecture (WebSocket, function calls) | Tasks 4, 16, 18 |
| Data Model (Prisma) | Task 2 |
| Custom Functions (4 tools) | Tasks 5-7, 14 |
| Session Lifecycle (start/end) | Tasks 4, 16, 18-19 |
| Emma System Prompt | Task 13 |
| UI Layout (Split View) | Tasks 17-19 |
| Pages (7 routes) | Tasks 9-12, 19-21 |
| Auth (Google OAuth + allowlist) | Task 3 |
| Project Structure | All tasks |
| Environment Variables | Task 1 |
| Error Handling | Task 22 |
| Audio Pipeline (PCM16, 24kHz) | Tasks 15-16 |
| Memory behavior (dedup) | Task 5 |

**2. Placeholder scan:** No TBD/TODO/fill-in patterns found.

**3. Type consistency:** All function names (`save_mistake`, `get_user_history`, `generate_exercise`, `save_progress`) are consistent between `tools.ts`, `client.ts`, and `VoiceConversation.tsx`. Prisma model fields match between `schema.prisma` and API routes.
