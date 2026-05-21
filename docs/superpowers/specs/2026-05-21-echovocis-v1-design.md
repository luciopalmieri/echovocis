# EchoVocis V1 — Design Document

**Date:** 2026-05-21
**Status:** Approved
**Scope:** MVP with memory

---

## 1. Product Summary

EchoVocis is a voice-first web app that helps users improve spoken fluency in foreign languages through real-time conversation with Emma, an AI voice coach. The core loop: the user speaks, Emma responds with corrections/translations, the user improves.

Emma automatically detects whether the user is speaking in the target language (correct and improve) or their native language (translate and encourage repetition). No manual mode switching required.

---

## 2. Key Decisions

| Decision | Choice |
|-----------|--------|
| Platform | Web app (mobile-first) |
| Scope | MVP with memory (core loop + session memory + basic exercises) |
| Emma's voice | `ara` — warm, friendly (Grok Voice built-in) |
| Languages | Multi-language (user chooses native + target from Grok-supported languages) |
| Persistence | Backend + PostgreSQL database |
| Tech stack | Next.js 15 (App Router) + TypeScript + Prisma + Tailwind CSS |
| Voice approach | Grok Voice Agent API (direct speech-to-speech WebSocket) |
| Interaction mode | Auto-detect language — no manual mode switching |
| UI layout | Split View — transcript/correction above, controls below |
| Prompt language | English (with auto-detect for clarification language) |
| Authentication | Google OAuth (NextAuth.js) + email allowlist (env variable) |
| Hosting | Vercel |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────┐
│                  Browser Client                  │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Mic/Voice │  │  Audio   │  │  UI React    │  │
│  │  Capture   │  │ Playback │  │  Components  │  │
│  └─────┬──────┘  └────▲─────┘  └──────┬───────┘  │
│        │              │               │          │
│        └──────────────┼───────────────┘          │
│                       │                          │
│           WebSocket (ephemeral token)            │
└───────────────────────┬──────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────┐
│           Grok Voice Agent API                     │
│           wss://api.x.ai/v1/realtime              │
│                                                    │
│  voice: "ara"                                      │
│  instructions: [Emma system prompt]                │
│  tools: [save_mistake, get_history,                │
│          generate_exercise, save_progress]         │
│  turn_detection: server_vad                        │
└───────────────────────┬───────────────────────────┘
                        │ function calls
                        ▼
┌───────────────────────────────────────────────────┐
│              Next.js Backend (API Routes)          │
│                                                    │
│  /api/auth/[...nextauth]  → Google OAuth           │
│  /api/session             → ephemeral token gen    │
│  /api/memory              → CRUD mistakes/history  │
│  /api/exercises           → personalized exercises │
│                                                    │
│  Database: PostgreSQL (Prisma ORM)                 │
└───────────────────────────────────────────────────┘
```

### Voice connection flow

1. User opens app → backend generates ephemeral token via `POST /v1/realtime/client_secrets`
2. Browser connects to Grok Voice Agent via WebSocket using ephemeral token
3. Session configured with Emma's system prompt, voice `ara`, and custom functions
4. User speaks → Grok handles STT, reasoning, and TTS in a single real-time stream
5. When Emma identifies mistakes or generates exercises, she calls custom functions → backend persists/retrieves data from DB

---

## 4. Data Model

```prisma
model User {
  id             String    @id @default(cuid())
  email          String    @unique
  name           String?
  image          String?
  nativeLanguage String    // e.g. "it"
  targetLanguage String    // e.g. "en"
  createdAt      DateTime  @default(now())

  sessions   Session[]
  mistakes   Mistake[]
  exercises  Exercise[]
  progress   Progress[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  startedAt DateTime @default(now())
  endedAt   DateTime?
}

model Mistake {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  original        String   // what the user said
  corrected       String   // Emma's corrected version
  type            String   // grammar | vocabulary | pronunciation | fluency
  targetLanguage  String
  occurrenceCount Int      @default(1)
  lastSeenAt      DateTime @default(now())
  createdAt       DateTime @default(now())

  exercises Exercise[]
}

model Progress {
  id                  String   @id @default(cuid())
  userId              String
  user                User     @relation(fields: [userId], references: [id])
  date                DateTime @default(now())
  targetLanguage      String   // scoped per language for multi-language readiness
  sentencesSpoken     Int      @default(0)
  mistakesCount       Int      @default(0)
  correctionsAccepted Int      @default(0)
  streakDays          Int      @default(0)
}

model Exercise {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  targetLanguage  String    // scoped per language for multi-language readiness
  type            String    // drill | repetition | translation_prompt | fluency_booster
  content         String    // exercise prompt/text
  completed       Boolean   @default(false)
  completedAt     DateTime?
  score           Int?
  createdAt       DateTime  @default(now())

  basedOnMistakes Mistake[]
}
```

### Memory behavior

1. During conversation, when Emma corrects something, the Voice Agent calls `save_mistake` → backend saves to DB
2. At session start, backend loads recent mistakes and recurring patterns and injects them into Emma's system prompt
3. When user asks for exercises, Emma calls `generate_exercise` → backend selects recent mistakes and generates targeted drills
4. At session end, backend updates progress counters (sentences spoken, mistakes, streak)

---

## 5. Custom Functions (Voice Agent Tools)

| Function | Purpose | Parameters |
|----------|---------|------------|
| `save_mistake` | Save an identified mistake | `original`, `corrected`, `type`, `targetLanguage` |
| `get_user_history` | Retrieve recent mistakes and patterns | `userId`, `limit` |
| `generate_exercise` | Create exercise based on user mistakes | `type`, `basedOnMistakeIds` |
| `save_progress` | Update session counters | `sentencesSpoken`, `mistakesCount`, `targetLanguage` |

---

## 6. Session Lifecycle

- **Starts:** User clicks "Talk with Emma" → backend generates ephemeral token → browser opens WebSocket
- **During:** Auto-detect language, correction/translation automatic, mistakes saved in background
- **Ends:** User closes conversation explicitly, leaves page, or 5 minutes of inactivity → backend saves progress and closes

No manual mode switching. Emma detects language automatically and reacts accordingly.

---

## 7. Emma — System Prompt

```
You are Emma, a voice-based language fluency coach for the EchoVocis app.

Your goal is to help the user speak {targetLanguage} more fluently and naturally through real conversation.

USER CONTEXT:
- Native language: {nativeLanguage}
- Target language: {targetLanguage}
- Recurring mistakes: {recentMistakes}
- Sessions completed: {sessionCount}

CORE BEHAVIOR:
- If the user speaks in {targetLanguage}: listen, identify mistakes or unnatural phrasing, then repeat the sentence in a corrected and more natural version. Briefly explain the correction.
- If the user speaks in {nativeLanguage}: translate the sentence into {targetLanguage}, offer a more natural version if possible, and encourage the user to repeat it aloud.

CLARIFICATION:
- If the user asks to repeat or clarify something in {nativeLanguage} (e.g. "non ho capito", "puoi ripetere?"), explain again in {nativeLanguage}.
- If the user asks to repeat or clarify something in {targetLanguage} (e.g. "I don't understand", "can you repeat please?"), explain again in {targetLanguage}.
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
- Speak in {targetLanguage} by default, except when explaining a correction to a beginner or when the user asks for clarification in {nativeLanguage}.
```

The prompt is built dynamically by the backend at session start, filling placeholders with real user data from the DB.

---

## 8. UI Layout — Split View

```
┌─────────────────────────────────┐
│  ≡  EchoVocis    🇬🇧 EN → IT 🇮🇹 │  ← Navbar
├─────────────────────────────────┤
│                                 │
│  LIVE TRANSCRIPTION             │
│  ┌─────────────────────────┐    │
│  │ "I went to the store    │    │
│  │  and I ~~buy~~ milk"    │    │  ← User's speech (strikethrough on errors)
│  └─────────────────────────┘    │
│                                 │
│  EMMA'S CORRECTION              │
│  ┌─────────────────────────┐    │
│  │ "...and I **bought**    │    │
│  │  some milk."            │    │  ← Corrected version (highlighted)
│  │                          │    │
│  │ 💡 Past simple:         │    │  ← Brief explanation
│  │    buy → bought          │    │
│  └─────────────────────────┘    │
│                                 │
├─────────────────────────────────┤
│                                 │
│     🎤          📚      📊      │  ← Bottom bar: Mic, Exercises, Progress
│  Tocca per    Esercizi  Progresso│
│  parlare                        │
│                                 │
└─────────────────────────────────┘
```

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/login` | Google OAuth login |
| `/onboarding` | First-time: choose native + target language |
| `/practice` | Main conversation page with Emma (Split View) |
| `/exercises` | Personalized exercises based on mistakes |
| `/progress` | History, streak, mistake patterns |
| `/settings` | Languages, profile |

---

## 9. Authentication & Access Control

- **Google OAuth** via NextAuth.js
- **Email allowlist** via `ALLOWED_EMAILS` env variable
- Auth flow: User clicks "Sign in with Google" → NextAuth callback checks if email is in allowlist → if yes, create session; if no, redirect to "Access denied" page

`.env.local`:
```
ALLOWED_EMAILS=user1@gmail.com,user2@gmail.com
```

---

## 10. Project Structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Landing
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx              # Auth required
│   │   ├── onboarding/page.tsx
│   │   ├── practice/page.tsx       # Main voice conversation
│   │   ├── exercises/page.tsx
│   │   ├── progress/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/
│       ├── session/route.ts        # Ephemeral token
│       ├── memory/route.ts         # CRUD mistakes
│       └── exercises/route.ts      # Generate exercises
├── lib/
│   ├── grok.ts                     # Voice Agent WebSocket client
│   ├── grok-prompt.ts              # System prompt builder
│   ├── grok-tools.ts               # Custom function handlers
│   ├── auth.ts                     # NextAuth config
│   └── db.ts                       # Prisma client
├── components/
│   ├── VoiceConversation.tsx       # Main voice component
│   ├── TranscriptPanel.tsx         # Transcript area
│   ├── CorrectionCard.tsx          # Correction display
│   ├── VoiceButton.tsx             # Mic button
│   └── Navbar.tsx
└── prisma/
    └── schema.prisma
```

---

## 11. Environment Variables

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
```

---

## 12. Out of Scope for V1

These features from the brand brief are deferred:

- CEFR level estimation
- Advanced modes (pronunciation mode, roleplay, stand-up practice, test mode)
- Pronunciation analytics
- Multi-language fluency (multiple target languages per user)
- Team/enterprise features
- Custom voice for Emma

---

## 13. Future Expansion

- CEFR level estimation with progress tracking
- Additional interaction modes (pronunciation, roleplay, test)
- Custom voice for Emma via Grok Custom Voices API
- Mobile native apps (iOS/Android) using same backend
- Team/enterprise language coaching
- Pronunciation analytics with visual feedback

---

## 14. Multi-Language Migration Path

V1 supports one target language per user. The schema is pre-disposed for multi-language:

### Already ready (V1)
- `Mistake.targetLanguage` — mistakes scoped per language
- `Exercise.targetLanguage` — exercises scoped per language
- `Progress.targetLanguage` — progress tracked per language
- Dynamic system prompt with `{targetLanguage}` and `{nativeLanguage}` placeholders

### Future changes (when multi-language is needed)
1. Add `UserLanguage` join table (userId, language, role: "native"|"target", isActive)
2. Keep `User.targetLanguage` as the "active target" for current session (denormalized for simplicity)
3. Add language selector in UI (navbar or settings) to switch active target language
4. Onboarding: allow selecting multiple target languages
5. Migrate existing `User.targetLanguage` values into `UserLanguage` rows

### Migration cost
- Low: all transactional data (mistakes, exercises, progress) will already be scoped
- No retroactive data migration needed — historical data carries its `targetLanguage`
- Only structural change is the join table + UI for language switching
