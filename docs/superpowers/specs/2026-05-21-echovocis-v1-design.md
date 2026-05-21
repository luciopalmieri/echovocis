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
| Authentication | Google OAuth (NextAuth.js v5 beta) + email allowlist (env variable) |
| Hosting | Vercel |

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       Browser Client                              │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Mic/Voice │  │  Audio   │  │  UI React    │  │  Function  │  │
│  │  Capture   │  │ Playback │  │  Components  │  │  Handlers  │  │
│  └─────┬──────┘  └────▲─────┘  └──────────────┘  └──────┬─────┘  │
│        │              │                                 │        │
│        └──────────────┼─────────────────────────────────┘        │
│                       │                                           │
│         WebSocket (ephemeral token via sec-websocket-protocol)    │
│         bidirectional: audio in/out, function call events         │
└──────────┬────────────────────────────────────────────┬───────────┘
           │                                            │
  audio + text events                         function call events
  (response.output_audio.delta,                (response.function_call_arguments.done)
   response.text.delta,                                 │
   input transcription)                                 │
           │                                            │ HTTP
           ▼                                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Grok Voice Agent API                             │
│                  wss://api.x.ai/v1/realtime?model=grok-voice-latest
│                                                                   │
│  voice: "ara"                                                     │
│  instructions: [Emma system prompt]                               │
│  tools: [save_mistake, get_user_history,                          │
│          generate_exercise, save_progress]                        │
│  turn_detection: server_vad (silence_duration_ms: 1500)           │
└──────────────────────────────────────────────────────────────────┘
                                            │
                                            │ function results via
                                            │ conversation.item.create
                                            │ (function_call_output)
                                            │
           ┌────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Next.js Backend (API Routes)                    │
│                                                                   │
│  /api/auth/[...nextauth]  → Google OAuth                          │
│  /api/session             → ephemeral token gen                   │
│  /api/memory              → CRUD mistakes/history                 │
│  /api/exercises           → personalized exercises                │
│  /api/progress            → save/retrieve progress                │
│                                                                   │
│  Database: PostgreSQL (Prisma ORM)                                │
└──────────────────────────────────────────────────────────────────┘
```

### Voice connection flow

1. User clicks "Talk with Emma" → backend generates ephemeral token via `POST /v1/realtime/client_secrets`
2. Browser opens mic (`getUserMedia`) **in parallel** with WebSocket connection to `wss://api.x.ai/v1/realtime?model=grok-voice-latest` using `sec-websocket-protocol: xai-client-secret.{token}`
3. Browser sends `session.update` with Emma's system prompt, voice `ara`, custom functions (with full JSON schemas), and `turn_detection: { type: "server_vad", silence_duration_ms: 1500 }`
4. User speaks → audio streamed via `input_audio_buffer.append` → Grok handles STT, reasoning, and TTS in real-time → browser receives `response.output_audio.delta` for playback and `response.text.delta` for transcript
5. When Emma identifies mistakes or generates exercises, Grok sends `response.function_call_arguments.done` → **browser handler** calls backend API (`/api/memory`, `/api/exercises`) → sends result back to Grok via `conversation.item.create` (function_call_output) + `response.create`

---

## 4. Data Model

```prisma
model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  name                String?
  image               String?
  nativeLanguage      String    // e.g. "it"
  targetLanguage      String    // e.g. "en"
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
  targetLanguage String   // language practiced in this session
  startedAt      DateTime @default(now())
  endedAt        DateTime?

  mistakes  Mistake[]

  @@index([userId, startedAt])
}

model Mistake {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  original        String   // what the user said
  corrected       String   // Emma's corrected version
  type            String   // grammar | vocabulary | pronunciation | fluency
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
  targetLanguage      String   // scoped per language for multi-language readiness
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

1. During conversation, when Emma corrects something, the Voice Agent calls `save_mistake` → browser calls `POST /api/memory` → backend saves to DB
2. **Mistake deduplication (backend-side):** `POST /api/memory` queries for an existing mistake with same `userId` + `targetLanguage` + `original` (exact match). If found, increments `occurrenceCount` and updates `lastSeenAt`. If not found, creates a new row. This prevents duplicate rows for recurring errors while keeping the logic out of the AI's responsibility.
3. At session start, backend loads recent mistakes and recurring patterns and injects them into Emma's system prompt
3. When user asks for exercises, Emma calls `generate_exercise` → backend selects recent mistakes and generates targeted drills
4. At session end, backend updates progress counters (sentences spoken, mistakes, streak)

---

## 5. Custom Functions (Voice Agent Tools)

| Function | Purpose | Parameters |
|----------|---------|------------|
| `save_mistake` | Save an identified mistake | `original`, `corrected`, `type`, `targetLanguage` |
| `get_user_history` | Retrieve recent mistakes and patterns | `limit` |
| `generate_exercise` | Create exercise based on user mistakes | `type`, `basedOnMistakeIds` |
| `save_progress` | Update session counters | `sentencesSpoken`, `mistakesCount`, `correctionsAccepted`, `targetLanguage` |

### Function JSON Schemas

These schemas are sent in the `session.update` message under `tools` and define exactly how the Voice Agent calls each function.

```json
[
  {
    "type": "function",
    "name": "save_mistake",
    "description": "Save a language mistake identified during conversation. Call this when you correct a significant error in the user's speech — grammar mistakes, wrong word choices, or unnatural phrasing. Do not save minor pronunciation variations.",
    "parameters": {
      "type": "object",
      "properties": {
        "original": { "type": "string", "description": "What the user actually said (their version)" },
        "corrected": { "type": "string", "description": "The corrected, natural version" },
        "type": { "type": "string", "enum": ["grammar", "vocabulary", "pronunciation", "fluency"], "description": "Category of the mistake" },
        "targetLanguage": { "type": "string", "description": "ISO language code of the target language (e.g. 'en', 'it')" }
      },
      "required": ["original", "corrected", "type", "targetLanguage"]
    }
  },
  {
    "type": "function",
    "name": "get_user_history",
    "description": "Retrieve the user's recent mistakes and recurring patterns. Call this at the start of a session or when you want to check what the user has been struggling with, to personalize your coaching.",
    "parameters": {
      "type": "object",
      "properties": {
        "limit": { "type": "integer", "description": "Max number of recent mistakes to return (default 10, max 50)" }
      },
      "required": []
    }
  },
  {
    "type": "function",
    "name": "generate_exercise",
    "description": "Create a personalized exercise based on the user's past mistakes. Call this when the user asks for practice or when you want to reinforce a weak point you've noticed.",
    "parameters": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["drill", "repetition", "translation_prompt", "fluency_booster"], "description": "Type of exercise to generate" },
        "basedOnMistakeIds": { "type": "array", "items": { "type": "string" }, "description": "IDs of mistakes to base the exercise on. If empty, the backend selects the most recent recurring mistakes." }
      },
      "required": ["type"]
    }
  },
  {
    "type": "function",
    "name": "save_progress",
    "description": "Update the user's session progress counters. Call this periodically during conversation (roughly every few exchanges) to track how much the user has spoken and how many mistakes were made.",
    "parameters": {
      "type": "object",
      "properties": {
        "sentencesSpoken": { "type": "integer", "description": "Number of sentences the user has spoken so far this session" },
        "mistakesCount": { "type": "integer", "description": "Number of mistakes identified so far this session" },
        "correctionsAccepted": { "type": "integer", "description": "Number of times the user repeated the corrected version" },
        "targetLanguage": { "type": "string", "description": "ISO language code of the target language (e.g. 'en', 'it')" }
      },
      "required": ["sentencesSpoken", "mistakesCount", "correctionsAccepted", "targetLanguage"]
    }
  }
]
```

### Auth context in function calls

All backend API calls from the browser include the authenticated userId via session cookie (NextAuth `getServerSession()`). Backend endpoints never accept `userId` from request body — it is always derived from the server-side session. This prevents any manipulation of AI-generated parameters from accessing another user's data.

---

## 6. Session Lifecycle

- **Starts:** User clicks "Talk with Emma" → backend generates ephemeral token → browser opens WebSocket
- **During:** Auto-detect language, correction/translation automatic, mistakes saved in background
- **Ends:** User closes conversation explicitly, leaves page, or token expires → backend saves progress and closes. Session duration controlled by `SESSION_TTL_SECONDS` env variable (default 300s / 5 min).

No manual mode switching. Emma detects language automatically and reacts accordingly.

### Audio Pipeline

**Format:** PCM16 little-endian, 24000 Hz (matches Grok default — no resampling needed).

**Microphone → Grok (input):**
1. `navigator.mediaDevices.getUserMedia({ audio: true })` on "Talk with Emma" click (Safari requires AudioContext creation during user gesture)
2. `AudioContext` at 24000 Hz → `ScriptProcessorNode` or `AudioWorklet` captures Float32 chunks
3. Float32 → Int16 (PCM16) → base64 → `input_audio_buffer.append` via WebSocket
4. Audio buffered immediately on mic start, flushed when WebSocket opens (parallel init)

**Grok → Speaker (output):**
1. Receive `response.output_audio.delta` events → base64 decode → PCM16 → Float32
2. Queue into `AudioContext` playback buffer — stream deltas instantly, do not wait for full response
3. Show "Emma is speaking" indicator while receiving audio deltas

**Transcription (for UI):**
- `response.text.delta` → Emma's spoken text (for correction cards)
- `conversation.item.input_audio_transcription.completed` → user's transcribed speech (for transcript panel)

**Audio event flow:**
```
Mic → getUserMedia → AudioContext (24kHz) → PCM16 → base64 → input_audio_buffer.append → Grok
Grok → response.output_audio.delta → base64 → PCM16 → AudioContext → Speaker
Grok → response.text.delta → UI (transcript/correction)
Grok → response.function_call_arguments.done → function handler → backend API → result back to Grok
```

### Error Handling

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Ephemeral token generation fails (429/503) | `POST /api/session` returns error | Show error toast in UI, retry with exponential backoff (max 3 attempts) |
| WebSocket disconnects mid-conversation | `ws.onclose` event | Show "Connection lost" message, offer "Resume session" button that generates new token and reconnects. Audio buffered during disconnect is discarded. |
| Backend API call fails during function handling | HTTP error from `/api/memory` or `/api/exercises` | Send error result back to Grok (`function_call_output` with error message) so Emma can inform the user. Log the error server-side. |
| Mic permission denied | `getUserMedia` rejects | Show permission prompt with instructions. Block session start until granted. |

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
- If the user mixes both languages in one sentence, translate the {nativeLanguage} portion into {targetLanguage} and correct the {targetLanguage} portion. Present the full corrected sentence.

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
SESSION_TTL_SECONDS=300
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
