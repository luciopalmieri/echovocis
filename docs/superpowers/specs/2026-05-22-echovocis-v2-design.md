# EchoVocis V2 — Design Document

**Date:** 2026-05-22
**Status:** Approved
**Scope:** Pivot from Grok Voice API to Agno + Telegram bot

---

## 1. Product Summary

EchoVocis is a voice-first language fluency coach. Emma, the AI coach, helps users improve spoken foreign languages through real-time correction, translation, memory, and personalized practice.

V2 pivots from a Grok Voice Agent WebSocket approach to a **Telegram bot** powered by **Agno** (Python agent framework) with a modular STT/TTS/LLM pipeline. The product vision and Emma's personality remain unchanged (see brand brief).

---

## 2. Why the Pivot

The Grok Voice Agent API (speech-to-speech) provided insufficient control over the pipeline, lacked the flexibility needed for customization, had sporadic latency issues, and was expensive — especially considering additional STT costs on top of the voice API pricing. The team was effectively building a chat rather than a controllable voice agent.

---

## 3. Key Decisions

| Decision | Choice |
|----------|--------|
| Interface | Telegram bot (voice + text messages) |
| Agent framework | Agno (Python) |
| LLM (default) | OpenAI GPT-4o |
| STT (default) | xAI Grok |
| TTS (default) | xAI Grok |
| Database | PostgreSQL (SQLAlchemy + Alembic) |
| Deployment | Docker Compose |
| Data model | Migrated from V1 prototype (Prisma → SQLAlchemy) |
| Model agnosticism | Provider abstraction via strategy pattern, configured via env vars |
| Prototype strategy | V1 project moved to `/prototype/`, new project in root |
| Response modality | Mirrors input: audio in → audio out, text in → text out (with optional inline buttons for the other modality) |

---

## 4. Architecture

```
┌──────────────┐   voice/text messages + inline buttons   ┌─────────────────────────┐
│   Telegram    │◄───────────────────────────────────────►│    Agno Agent (Emma)     │
│     Bot       │                                         │                         │
└──────────────┘                                         │  ┌───────┐ ┌──────────┐ │
                                                         │  │  LLM  │ │  Tools   │ │
                                                         │  │(plugg)│ │(memory,  │ │
                                                         │  └───────┘ │exercise, │ │
                                                         │  ┌───────┐ │analyze)  │ │
                                                         │  │  STT  │ └──────────┘ │
                                                         │  │(plugg)│              │
                                                         │  └───────┘              │
                                                         │  ┌───────┐              │
                                                         │  │  TTS  │              │
                                                         │  │(plugg)│              │
                                                         │  └───────┘              │
                                                         └────────────┬────────────┘
                                                                      │
                                                                      ▼
                                                         ┌────────────────────────┐
                                                         │     PostgreSQL          │
                                                         │  (SQLAlchemy + Alembic) │
                                                         └────────────────────────┘
```

### Message flows

**Voice message in:**
1. User sends voice message on Telegram
2. Bot downloads audio file → STT provider (xAI) → transcription
3. Transcription + context (history, mistakes, session) → LLM (GPT-4o) via Agno → Emma's text response
4. Text response → TTS provider (xAI) → audio file → sent as Telegram voice message
5. Inline button: "Show text" to display the text alongside the audio

**Text message in:**
1. User sends text message on Telegram
2. Text + context → LLM (GPT-4o) via Agno → Emma's text response
3. Text response sent as text message
4. Inline button: "Hear audio" to generate and send the audio version

### Provider abstraction

All providers (LLM, STT, TTS) implement abstract base classes:

```python
class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_data: bytes, language: str | None = None) -> str: ...

class TTSProvider(ABC):
    @abstractmethod
    async def synthesize(self, text: str, voice: str = "ara") -> bytes: ...

class LLMProvider(ABC):
    # Delegated to Agno's built-in model support
    ...
```

Changing a provider means implementing the interface and updating the env var. Zero changes to agent logic, tools, or Telegram handlers.

---

## 5. Data Model

Migrated from V1 Prisma schema to SQLAlchemy. New `Message` table added for full conversation tracking.

```python
class User:
    id: str (CUID)
    telegram_id: str (unique)       # Telegram user ID
    email: str | None               # optional, for future web access
    name: str | None
    native_language: str            # e.g. "it"
    target_language: str            # e.g. "en"
    onboarding_completed: bool
    created_at: datetime

class Session:
    id: str (CUID)
    user_id: str (FK → User)
    target_language: str
    started_at: datetime
    ended_at: datetime | None

class Message:
    id: str (CUID)
    user_id: str (FK → User)
    session_id: str (FK → Session)
    role: str                       # "user" | "emma"
    content: str                    # text content (transcription for voice, text for text)
    is_voice: bool                  # True if original message was voice
    is_correct: bool | None         # For user messages: True if no mistakes, False if mistakes found, None if not yet assessed. For emma messages: always None.
    telegram_file_id: str | None    # Telegram voice file ID (for voice messages)
    created_at: datetime

class Mistake:
    id: str (CUID)
    user_id: str (FK → User)
    original: str                   # what the user said
    corrected: str                  # Emma's corrected version
    type: str                       # grammar | vocabulary | pronunciation | fluency
    target_language: str
    session_id: str | None (FK → Session)
    occurrence_count: int           # incremented on deduplication
    last_seen_at: datetime
    created_at: datetime

class Progress:
    id: str (CUID)
    user_id: str (FK → User)
    date: datetime
    target_language: str
    sentences_spoken: int
    mistakes_count: int
    corrections_accepted: int
    streak_days: int
    # unique constraint: (user_id, target_language, date)

class Exercise:
    id: str (CUID)
    user_id: str (FK → User)
    target_language: str
    type: str                       # drill | repetition | translation_prompt | fluency_booster
    content: str                    # exercise prompt/text
    completed: bool
    completed_at: datetime | None
    score: int | None
    created_at: datetime
    # many-to-many with Mistake via ExerciseMistake join table
```

### Mistake deduplication

Identical to V1: `save_mistake` queries for existing `userId + targetLanguage + original` (exact match). If found, increments `occurrence_count` and updates `last_seen_at`. Otherwise creates new row.

---

## 6. Agent Tools (Agno)

| Tool | Purpose | Parameters |
|------|---------|------------|
| `save_mistake` | Save identified mistake | `original`, `corrected`, `type`, `target_language` |
| `get_user_history` | Retrieve recent mistakes and patterns | `limit` (default 10, max 50) |
| `generate_exercise` | Create exercise based on mistakes | `type`, `based_on_mistake_ids` (optional) |
| `save_progress` | Update session counters | `sentences_spoken`, `mistakes_count`, `corrections_accepted`, `target_language` |
| `analyze_level` | Analyze DB → estimate A1-C2 level | (user_id from agent session context, not explicit parameter) |

> **Note on tool context:** All tools receive `user_id` and `session_id` from the Agno agent's session context (set when the Telegram handler identifies the user). Tools never accept these from the LLM to prevent injection.

### `analyze_level` output

Returns structured assessment:
- Estimated CEFR level (A1–C2)
- Strengths (areas with few/no mistakes)
- Weaknesses (recurring mistake patterns)
- Recommended focus areas
- Based on: mistake frequency, type distribution, improvement trends over time

---

## 7. Emma — System Prompt

Adapted from V1. The core personality and behavior remain identical. Key change: Emma operates via text (Agno processes STT output and generates text for TTS), so the prompt is text-based, not voice-specific.

```
You are Emma, a language fluency coach for the EchoVocis app.

Your goal is to help the user speak {target_language} more fluently and naturally through real conversation.

USER CONTEXT:
- Native language: {native_language}
- Target language: {target_language}
- Recurring mistakes: {recent_mistakes}
- Sessions completed: {session_count}
- Estimated level: {estimated_level}

CORE BEHAVIOR:
- If the user speaks in {target_language}: listen, identify mistakes or unnatural phrasing, then repeat the sentence in a corrected and more natural version. Briefly explain the correction.
- If the user speaks in {native_language}: translate the sentence into {target_language}, offer a more natural version if possible, and encourage the user to repeat it aloud.
- If the user mixes both languages in one sentence, translate the {native_language} portion into {target_language} and correct the {target_language} portion. Present the full corrected sentence.

COMMUNICATION STYLE:
- Short and natural. Never deliver long monologues.
- Correct with warmth, never with judgment.
- Use simple language, not academic terms.
- Focus on naturalness over grammatical perfection.
- Always encourage repetition.

MEMORY TOOLS:
- When you identify a significant mistake, use save_mistake to save it.
- When the user asks for exercises, use generate_exercise to create one based on their mistakes.
- Use get_user_history to check the user's progress when needed.
- Use save_progress periodically to track session progress.
- When the user asks about their level or progress, use analyze_level.

RULES:
- Do not give grammar lectures. Correct and move on.
- Never be verbose. Brief response, then let the user speak.
- If the user says something correct and natural, confirm briefly and encourage them to continue.
- Speak in {target_language} by default, except when explaining a correction to a beginner or when the user asks for clarification in {native_language}.
```

The prompt is built dynamically at message time, filling placeholders with real user data from the DB.

---

## 8. Project Structure

```
echovocis/
├── prototype/                    # V1 Next.js project (preserved, independently runnable)
├── src/
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── emma.py              # Agno Agent definition
│   │   ├── tools.py             # Tool implementations
│   │   └── prompt.py            # System prompt builder
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── base.py              # Abstract base classes (STTProvider, TTSProvider)
│   │   ├── stt/
│   │   │   ├── __init__.py
│   │   │   └── xai.py           # xAI STT implementation
│   │   ├── tts/
│   │   │   ├── __init__.py
│   │   │   └── xai.py           # xAI TTS implementation
│   │   └── llm/
│   │       ├── __init__.py
│   │       └── factory.py       # Agno model factory (reads LLM_PROVIDER env)
│   ├── db/
│   │   ├── __init__.py
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── repository.py        # Query functions
│   │   └── session.py           # DB session management
│   ├── telegram/
│   │   ├── __init__.py
│   │   ├── bot.py               # Bot setup and startup
│   │   └── handlers.py          # Message handlers (voice, text, inline buttons, commands)
│   └── config.py                # Pydantic settings
├── alembic/
│   └── versions/
├── alembic.ini
├── tests/
│   ├── test_tools.py
│   ├── test_repository.py
│   └── test_handlers.py
├── docker-compose.yml
├── Dockerfile
├── pyproject.toml
├── .env.example
└── README.md
```

---

## 9. Session Lifecycle

A session represents a continuous conversation period with Emma.

- **Starts:** Automatically when the user sends the first message after `/start` or after an inactivity gap (default 10 min, configurable via `SESSION_TIMEOUT_MINUTES`).
- **During:** All messages (user and Emma) are logged to the current session.
- **Ends:** When `SESSION_TIMEOUT_MINUTES` of inactivity pass, or the user sends `/stop`, or the user sends `/start` again (which creates a new session).
- On session end, `save_progress` is called automatically (not by the LLM) to persist counters.

---

## 10. Telegram Bot — Commands & Interactions

| Command / Interaction | Behavior |
|-----------------------|----------|
| `/start` | Welcome message + onboarding if new user (ask native/target language) |
| `/settings` | Show/change languages, view profile |
| `/level` | Trigger `analyze_level` tool, show A1-C2 assessment |
| `/exercises` | Trigger `generate_exercise`, present exercise in chat |
| `/history` | Show recent mistakes and progress summary |
| Voice message | → STT → LLM → TTS → voice reply (with "Show text" inline button) |
| Text message | → LLM → text reply (with "Hear audio" inline button) |
| Inline button "Show text" | Sends the text of the last voice reply |
| Inline button "Hear audio" | Generates TTS for the last text reply and sends as voice message |

---

## 11. Environment Variables

```env
# LLM
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# STT
STT_PROVIDER=xai
XAI_API_KEY=xai-...

# TTS
TTS_PROVIDER=xai
TTS_VOICE=ara

# Telegram
TELEGRAM_BOT_TOKEN=...

# Database
DATABASE_URL=postgresql://echovocis:password@localhost:5432/echovocis

# App
APP_ENV=development
LOG_LEVEL=INFO
SESSION_TIMEOUT_MINUTES=10
```

---

## 12. Docker Compose

```yaml
services:
  db:
    image: postgres:17
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: echovocis
      POSTGRES_USER: echovocis
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"

  bot:
    build: .
    depends_on:
      - db
    env_file: .env
    volumes:
      - ./src:/app/src
    command: python -m src.telegram.bot

volumes:
  pgdata:
```

Development workflow:
- `docker compose up db` — start only the database
- `python -m src.telegram.bot` — run bot locally with hot reload
- Or `docker compose up` — run everything in containers

---

## 13. Migration Steps (V1 → V2)

1. Move entire V1 project content to `prototype/` directory (single git commit)
2. Create new Python project structure in root
3. Migrate Prisma schema → SQLAlchemy models
4. Implement Agno agent with Emma's tools
5. Implement provider abstraction (xAI STT/TTS, OpenAI LLM)
6. Implement Telegram bot handlers
7. Setup Alembic migrations
8. Setup Docker Compose
9. Test end-to-end: voice in → voice out

---

## 14. What We Keep from V1

- **Data model** — User, Session, Mistake, Progress, Exercise (migrated to SQLAlchemy)
- **Business logic** — mistake deduplication, progress tracking, streak calculation, exercise generation
- **Emma's prompt** — personality, behavior rules, communication style (adapted for text-based interaction)
- **Tool architecture** — save_mistake, get_user_history, generate_exercise, save_progress (plus new analyze_level)
- **Brand brief** — product vision, target users, differentiators (unchanged)

---

## 15. What Changes from V1

| V1 (Prototype) | V2 |
|----------------|-----|
| Next.js web app | Telegram bot |
| Grok Voice Agent API (speech-to-speech WebSocket) | Agno agent + separate STT/TTS/LLM pipeline |
| Browser audio pipeline (getUserMedia, PCM16) | Telegram voice messages (native recording) |
| NextAuth Google OAuth | Telegram user identity |
| Prisma ORM | SQLAlchemy + Alembic |
| Vercel deployment | Docker Compose |
| Single provider (xAI) | Model-agnostic with provider abstraction |
| Voice-only interaction | Voice + text (mirrors input modality) |
| React UI components | Telegram inline buttons |

---

## 16. Out of Scope for V2 MVP

- Web interface
- Custom Emma voice
- Roleplay / stand-up practice modes
- Multi-language per user
- Team/enterprise features
- Local model support (architected for, but not implemented initially)
- Pronunciation analytics
