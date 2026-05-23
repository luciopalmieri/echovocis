# EchoVocis

Language fluency coach powered by AI. Practice speaking through voice and text messages on Telegram.

Emma, the AI coach, listens to you, corrects mistakes, and helps you sound more natural in your target language.

## Architecture

- **Telegram Bot** (`python-telegram-bot`) — user interface via voice and text messages
- **AI Agent** (`agno` + OpenAI GPT-4o) — conversation, corrections, and exercises
- **STT/TTS** (xAI) — speech-to-text transcription and text-to-speech synthesis
- **Database** (PostgreSQL + SQLAlchemy async) — users, sessions, messages, mistakes, progress
- **Migrations** (Alembic) — database schema management

## Quick Start

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) package manager
- Docker & Docker Compose (for PostgreSQL)
- API keys: OpenAI, xAI, Telegram Bot Token

### Setup

1. Clone and install:

```bash
git clone <repo-url> && cd echovocis
uv sync
```

2. Configure environment:

```bash
cp .env.example .env
# Edit .env with your API keys
```

Required variables:

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key (GPT-4o) |
| `XAI_API_KEY` | xAI API key (STT + TTS) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather |
| `DATABASE_URL` | PostgreSQL async connection string (must use `+asyncpg` driver) |

`DATABASE_URL` must use the asyncpg driver, e.g.:

```
DATABASE_URL=postgresql+asyncpg://echovocis:echovocis@localhost:5432/echovocis
```

3. Start PostgreSQL:

```bash
docker compose up db -d
```

4. Run migrations (pass `DATABASE_URL` inline since the asyncpg driver is required):

```bash
DATABASE_URL="postgresql+asyncpg://echovocis:echovocis@localhost:5432/echovocis" uv run alembic upgrade head
```

5. Start the bot:

```bash
DATABASE_URL="postgresql+asyncpg://echovocis:echovocis@localhost:5432/echovocis" uv run python -m src.main
```

### Docker (full stack)

```bash
docker compose up -d
```

This starts PostgreSQL and the bot with automatic migration on startup.

## Project Structure

```
src/
├── main.py                 # Entrypoint
├── config.py               # Pydantic settings
├── agent/
│   ├── emma.py             # Agno Agent definition
│   ├── tools.py            # Agent tools (save_mistake, get_user_history, etc.)
│   └── prompt.py           # System prompt builder
├── providers/
│   ├── base.py             # STT/TTS abstract classes
│   ├── stt_xai.py          # xAI speech-to-text
│   └── tts_xai.py          # xAI text-to-speech
├── db/
│   ├── models.py           # SQLAlchemy models
│   ├── repository.py       # Query functions
│   └── session.py          # Async session factory
└── telegram_bot/
    ├── bot.py              # Bot setup and startup
    └── handlers.py         # Message and callback handlers
```

## Features

- **Voice and text practice** — send voice messages for pronunciation practice, or text for grammar corrections
- **Smart corrections** — Emma identifies mistakes, explains them briefly, and tracks recurring patterns
- **Onboarding** — set your native and target languages on first use
- **Inline buttons** — "Hear audio" on text replies, "Show text" on voice replies
- **Mistake tracking** — deduplicated mistake history with occurrence counts
- **Progress tracking** — daily stats, streak tracking, CEFR level estimation
- **Session management** — automatic session timeout with conversation continuity

## Testing

```bash
uv sync --extra dev
uv run pytest -v
```

## V1 Prototype

The original Next.js voice agent prototype is preserved in `prototype/`. See `prototype/README.md` for details.

## Tech Stack

| Component | Technology |
|---|---|
| Language | Python 3.12+ |
| AI Agent | Agno |
| LLM | OpenAI GPT-4o |
| STT/TTS | xAI |
| Bot Framework | python-telegram-bot v22+ |
| ORM | SQLAlchemy 2.0 (async) |
| Database | PostgreSQL 17 |
| Migrations | Alembic |
| Settings | pydantic-settings |
| Package Manager | uv |
| Containerization | Docker Compose |
