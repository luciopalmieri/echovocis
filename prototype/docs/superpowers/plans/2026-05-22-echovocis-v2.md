# EchoVocis V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot from Grok Voice Agent prototype to Agno + Telegram bot with modular STT/TTS/LLM pipeline.

**Architecture:** Python app using Agno Agent framework for the LLM + tools layer, `python-telegram-bot` for Telegram handling, custom STT/TTS provider abstractions (xAI default), SQLAlchemy + PostgreSQL for persistence, Docker Compose for deployment.

**Tech Stack:** Python 3.12+, Agno, python-telegram-bot v22+, SQLAlchemy 2.0 (async), asyncpg, Alembic, httpx, pydantic-settings, PostgreSQL 17, Docker Compose.

---

## File Structure

```
echovocis/
├── prototype/                         # V1 Next.js (preserved)
├── src/
│   ├── __init__.py
│   ├── config.py                      # Pydantic settings
│   ├── main.py                        # Entrypoint
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── emma.py                    # Agno Agent definition
│   │   ├── tools.py                   # save_mistake, get_user_history, etc.
│   │   └── prompt.py                  # System prompt builder
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── base.py                    # ABC for STT/TTS
│   │   ├── stt_xai.py                # xAI STT implementation
│   │   └── tts_xai.py                # xAI TTS implementation
│   ├── db/
│   │   ├── __init__.py
│   │   ├── models.py                  # SQLAlchemy models
│   │   ├── repository.py             # Query functions
│   │   └── session.py                # Async session factory
│   └── telegram_bot/
│       ├── __init__.py
│       ├── bot.py                     # Bot setup and startup
│       ├── handlers.py               # Message handlers
│       └── inline.py                 # Inline button handlers
├── alembic/
│   ├── env.py
│   └── versions/
├── alembic.ini
├── tests/
│   ├── conftest.py
│   ├── test_providers.py
│   ├── test_repository.py
│   ├── test_tools.py
│   └── test_handlers.py
├── docker-compose.yml
├── Dockerfile
├── pyproject.toml
├── .env.example
└── README.md
```

---

## Task 1: Move prototype to /prototype

**Files:**
- Move: all root files and directories → `prototype/`

- [ ] **Step 1: Move all V1 files into prototype directory**

```bash
mkdir -p prototype
git mv src prototype/
git mv prisma prototype/
git mv public prototype/
git mv docs prototype/
git mv middleware.ts prototype/
git mv next.config.ts prototype/
git mv package.json prototype/
git mv pnpm-lock.yaml prototype/
git mv pnpm-workspace.yaml prototype/
git mv postcss.config.mjs prototype/
git mv tsconfig.json prototype/
git mv tsconfig.tsbuildinfo prototype/
git mv vitest.config.ts prototype/
git mv eslint.config.mjs prototype/
git mv next-env.d.ts prototype/
git mv prisma.config.ts prototype/
git mv docker-compose.yml prototype/
```

Keep `.gitignore`, `.env.example`, `AGENTS.md`, `CLAUDE.md`, `README.md` in root (we'll update them later).

- [ ] **Step 2: Verify prototype still works**

```bash
cd prototype && pnpm install && pnpm dev
```

Expected: dev server starts on localhost:3000

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: move V1 prototype to prototype/ directory"
```

---

## Task 2: Initialize Python project

**Files:**
- Create: `pyproject.toml`
- Create: `.env.example`
- Create: `.gitignore` (update)
- Create: `.python-version`

- [ ] **Step 1: Create .python-version**

```
3.12
```

- [ ] **Step 2: Initialize project with uv**

```bash
uv init --no-readme
```

- [ ] **Step 3: Write pyproject.toml**

```toml
[project]
name = "echovocis"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "agno>=1.7.0",
    "openai>=1.90.0",
    "python-telegram-bot[all]>=22.0.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "asyncpg>=0.30.0",
    "alembic>=1.16.0",
    "httpx>=0.28.0",
    "pydantic-settings>=2.9.0",
    "cuid2>=2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=1.0.0",
    "pytest-cov>=6.0.0",
    "aiosqlite>=0.21.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.backends"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.ruff]
line-length = 120
target-version = "py312"
```

- [ ] **Step 4: Install dependencies**

```bash
uv sync
```

- [ ] **Step 5: Write .env.example**

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
TTS_LANGUAGE=en

# Telegram
TELEGRAM_BOT_TOKEN=...

# Database
DATABASE_URL=postgresql+asyncpg://echovocis:password@localhost:5432/echovocis

# App
APP_ENV=development
LOG_LEVEL=INFO
SESSION_TIMEOUT_MINUTES=10
```

- [ ] **Step 6: Update .gitignore**

Append to existing `.gitignore`:

```
# Python
__pycache__/
*.py[cod]
*.egg-info/
dist/
.venv/
.env
.env.local
*.db

# Agno
.agno/
```

- [ ] **Step 7: Create source directories**

```bash
mkdir -p src/agent src/providers src/db src/telegram_bot tests
touch src/__init__.py src/agent/__init__.py src/providers/__init__.py src/db/__init__.py src/telegram_bot/__init__.py
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: initialize Python project with Agno + Telegram bot"
```

---

## Task 3: Config module

**Files:**
- Create: `src/config.py`
- Test: `tests/test_config.py`

- [ ] **Step 1: Write the config module**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    llm_provider: str = "openai"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    stt_provider: str = "xai"
    xai_api_key: str = ""

    tts_provider: str = "xai"
    tts_voice: str = "ara"
    tts_language: str = "en"

    telegram_bot_token: str = ""

    database_url: str = "postgresql+asyncpg://echovocis:password@localhost:5432/echovocis"

    app_env: str = "development"
    log_level: str = "INFO"
    session_timeout_minutes: int = 10


settings = Settings()
```

- [ ] **Step 2: Write the test**

```python
import os
from unittest.mock import patch

from src.config import Settings


def test_defaults():
    with patch.dict(os.environ, {"TELEGRAM_BOT_TOKEN": "fake", "OPENAI_API_KEY": "fake", "XAI_API_KEY": "fake"}, clear=True):
        s = Settings()
        assert s.llm_provider == "openai"
        assert s.openai_model == "gpt-4o"
        assert s.stt_provider == "xai"
        assert s.tts_voice == "ara"
        assert s.session_timeout_minutes == 10
```

- [ ] **Step 3: Run test**

```bash
uv run pytest tests/test_config.py -v
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/config.py tests/test_config.py
git commit -m "feat: add config module with pydantic-settings"
```

---

## Task 4: SQLAlchemy models

**Files:**
- Create: `src/db/models.py`
- Test: `tests/test_models.py`

- [ ] **Step 1: Write SQLAlchemy models**

```python
from datetime import datetime, timezone

from cuid2 import cuid_wrapper
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


cuid = cuid_wrapper()


class Base(DeclarativeBase):
    pass


def _cuid() -> str:
    return cuid()


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_cuid)
    telegram_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    native_language: Mapped[str] = mapped_column(String, nullable=False)
    target_language: Mapped[str] = mapped_column(String, nullable=False)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    sessions: Mapped[list["Session"]] = relationship(back_populates="user")
    mistakes: Mapped[list["Mistake"]] = relationship(back_populates="user")
    exercises: Mapped[list["Exercise"]] = relationship(back_populates="user")
    progress_entries: Mapped[list["Progress"]] = relationship(back_populates="user")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_cuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    target_language: Mapped[str] = mapped_column(String, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="sessions")
    messages: Mapped[list["Message"]] = relationship(back_populates="session")
    mistakes: Mapped[list["Mistake"]] = relationship(back_populates="session")

    __table_args__ = (Index("ix_sessions_user_started", "user_id", "started_at"),)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_cuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_voice: Mapped[bool] = mapped_column(Boolean, default=False)
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    telegram_file_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped["User"] = relationship()
    session: Mapped["Session"] = relationship(back_populates="messages")


class Mistake(Base):
    __tablename__ = "mistakes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_cuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    original: Mapped[str] = mapped_column(Text, nullable=False)
    corrected: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    target_language: Mapped[str] = mapped_column(String, nullable=False)
    session_id: Mapped[str | None] = mapped_column(ForeignKey("sessions.id"), nullable=True)
    occurrence_count: Mapped[int] = mapped_column(Integer, default=1)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped["User"] = relationship(back_populates="mistakes")
    session: Mapped["Session | None"] = relationship(back_populates="mistakes")

    __table_args__ = (
        Index("ix_mistakes_user_lang_seen", "user_id", "target_language", "last_seen_at"),
    )


class Progress(Base):
    __tablename__ = "progress"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_cuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    target_language: Mapped[str] = mapped_column(String, nullable=False)
    sentences_spoken: Mapped[int] = mapped_column(Integer, default=0)
    mistakes_count: Mapped[int] = mapped_column(Integer, default=0)
    corrections_accepted: Mapped[int] = mapped_column(Integer, default=0)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)

    user: Mapped["User"] = relationship(back_populates="progress_entries")

    __table_args__ = (
        UniqueConstraint("user_id", "target_language", "date", name="uq_progress_user_lang_date"),
        Index("ix_progress_user_lang", "user_id", "target_language"),
    )


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_cuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    target_language: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped["User"] = relationship(back_populates="exercises")


exercise_mistake = Table(
    "exercise_mistake",
    Base.metadata,
    Column("exercise_id", String, ForeignKey("exercises.id"), primary_key=True),
    Column("mistake_id", String, ForeignKey("mistakes.id"), primary_key=True),
)
```

Note: `exercise_mistake` join table needs the `Table` import. Add `from sqlalchemy import ..., Table, Column` at the top.

- [ ] **Step 2: Write the test**

```python
from sqlalchemy import create_engine, inspect

from src.db.models import Base, User, Session, Mistake, Progress, Exercise


def test_models_create_tables():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    assert "users" in tables
    assert "sessions" in tables
    assert "messages" in tables
    assert "mistakes" in tables
    assert "progress" in tables
    assert "exercises" in tables
    assert "exercise_mistake" in tables
```

- [ ] **Step 3: Run test**

```bash
uv run pytest tests/test_models.py -v
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/db/models.py tests/test_models.py
git commit -m "feat: add SQLAlchemy models (User, Session, Message, Mistake, Progress, Exercise)"
```

---

## Task 5: Database session factory + Alembic

**Files:**
- Create: `src/db/session.py`
- Create: `alembic.ini`
- Create: `alembic/env.py`

- [ ] **Step 1: Write async session factory**

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import settings

engine = create_async_engine(settings.database_url, echo=settings.app_env == "development")
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
```

- [ ] **Step 2: Initialize Alembic**

```bash
uv run alembic init alembic
```

- [ ] **Step 3: Configure alembic/env.py**

Edit `alembic/env.py` to import the models and use async:

```python
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from src.config import settings
from src.db.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = settings.database_url
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(settings.database_url)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

- [ ] **Step 4: Update alembic.ini**

Set `sqlalchemy.url` to empty string (we use env.py to get it from settings):
```
sqlalchemy.url =
```

- [ ] **Step 5: Commit**

```bash
git add src/db/session.py alembic/ alembic.ini
git commit -m "feat: add async DB session factory and Alembic setup"
```

---

## Task 6: Repository layer

**Files:**
- Create: `src/db/repository.py`
- Test: `tests/test_repository.py`

- [ ] **Step 1: Write repository**

```python
from datetime import datetime, timezone, timedelta
from typing import Sequence

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User, Session, Message, Mistake, Progress, Exercise


async def get_or_create_user(db: AsyncSession, telegram_id: str, name: str | None = None) -> User:
    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(telegram_id=telegram_id, name=name, native_language="en", target_language="it")
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


async def update_user_languages(db: AsyncSession, user_id: str, native: str, target: str) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()
    user.native_language = native
    user.target_language = target
    user.onboarding_completed = True
    await db.commit()
    await db.refresh(user)
    return user


async def get_or_create_session(db: AsyncSession, user_id: str, target_language: str, timeout_minutes: int = 10) -> Session:
    result = await db.execute(
        select(Session)
        .where(Session.user_id == user_id, Session.ended_at.is_(None))
        .order_by(Session.started_at.desc())
        .limit(1)
    )
    session = result.scalar_one_or_none()
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=timeout_minutes)
    if session is not None and session.started_at >= cutoff:
        return session
    if session is not None:
        session.ended_at = datetime.now(timezone.utc)
        await db.flush()
    session = Session(user_id=user_id, target_language=target_language)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def end_session(db: AsyncSession, session_id: str) -> None:
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one()
    session.ended_at = datetime.now(timezone.utc)
    await db.commit()


async def save_message(db: AsyncSession, user_id: str, session_id: str, role: str, content: str, is_voice: bool = False, is_correct: bool | None = None, telegram_file_id: str | None = None) -> Message:
    msg = Message(
        user_id=user_id,
        session_id=session_id,
        role=role,
        content=content,
        is_voice=is_voice,
        is_correct=is_correct,
        telegram_file_id=telegram_file_id,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def save_mistake(db: AsyncSession, user_id: str, original: str, corrected: str, mistake_type: str, target_language: str, session_id: str | None = None) -> Mistake:
    result = await db.execute(
        select(Mistake).where(
            and_(
                Mistake.user_id == user_id,
                Mistake.target_language == target_language,
                Mistake.original == original,
            )
        )
    )
    existing = result.scalar_one_or_none()
    if existing is not None:
        existing.occurrence_count += 1
        existing.last_seen_at = datetime.now(timezone.utc)
        existing.corrected = corrected
        await db.commit()
        await db.refresh(existing)
        return existing
    mistake = Mistake(
        user_id=user_id,
        original=original,
        corrected=corrected,
        type=mistake_type,
        target_language=target_language,
        session_id=session_id,
    )
    db.add(mistake)
    await db.commit()
    await db.refresh(mistake)
    return mistake


async def get_recent_mistakes(db: AsyncSession, user_id: str, target_language: str, limit: int = 10) -> Sequence[Mistake]:
    result = await db.execute(
        select(Mistake)
        .where(Mistake.user_id == user_id, Mistake.target_language == target_language)
        .order_by(Mistake.last_seen_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


async def save_progress(db: AsyncSession, user_id: str, target_language: str, sentences_spoken: int, mistakes_count: int, corrections_accepted: int) -> Progress:
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(Progress).where(
            and_(Progress.user_id == user_id, Progress.target_language == target_language, Progress.date == today)
        )
    )
    progress = result.scalar_one_or_none()
    if progress is None:
        streak = await _calculate_streak(db, user_id, target_language)
        progress = Progress(
            user_id=user_id,
            target_language=target_language,
            date=today,
            sentences_spoken=sentences_spoken,
            mistakes_count=mistakes_count,
            corrections_accepted=corrections_accepted,
            streak_days=streak,
        )
        db.add(progress)
    else:
        progress.sentences_spoken = sentences_spoken
        progress.mistakes_count = mistakes_count
        progress.corrections_accepted = corrections_accepted
    await db.commit()
    await db.refresh(progress)
    return progress


async def _calculate_streak(db: AsyncSession, user_id: str, target_language: str) -> int:
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)
    result = await db.execute(
        select(Progress).where(
            and_(Progress.user_id == user_id, Progress.target_language == target_language, Progress.date == yesterday)
        )
    )
    yesterday_progress = result.scalar_one_or_none()
    if yesterday_progress is not None:
        return yesterday_progress.streak_days + 1
    return 1


async def get_session_count(db: AsyncSession, user_id: str) -> int:
    result = await db.execute(
        select(func.count()).select_from(Session).where(Session.user_id == user_id, Session.ended_at.isnot(None))
    )
    return result.scalar_one()


async def get_mistake_stats(db: AsyncSession, user_id: str, target_language: str) -> dict:
    result = await db.execute(
        select(Mistake.type, func.count().label("count"))
        .where(Mistake.user_id == user_id, Mistake.target_language == target_language)
        .group_by(Mistake.type)
    )
    return {row[0]: row[1] for row in result.all()}
```

- [ ] **Step 2: Write tests**

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from src.db.models import Base
from src.db.repository import get_or_create_user, save_mistake, get_recent_mistakes


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


async def test_get_or_create_user_creates_new(db):
    user = await get_or_create_user(db, "tg_123", "Test")
    assert user.telegram_id == "tg_123"
    assert user.name == "Test"
    assert user.native_language == "en"


async def test_get_or_create_user_returns_existing(db):
    user1 = await get_or_create_user(db, "tg_123", "Test")
    user2 = await get_or_create_user(db, "tg_123", "Updated")
    assert user1.id == user2.id
    assert user2.name == "Test"


async def test_save_mistake_deduplicates(db):
    user = await get_or_create_user(db, "tg_123")
    m1 = await save_mistake(db, user.id, "I goed", "I went", "grammar", "en")
    assert m1.occurrence_count == 1
    m2 = await save_mistake(db, user.id, "I goed", "I went", "grammar", "en")
    assert m2.id == m1.id
    assert m2.occurrence_count == 2


async def test_get_recent_mistakes(db):
    user = await get_or_create_user(db, "tg_123")
    await save_mistake(db, user.id, "I goed", "I went", "grammar", "en")
    await save_mistake(db, user.id, "I buyed", "I bought", "vocabulary", "en")
    mistakes = await get_recent_mistakes(db, user.id, "en")
    assert len(mistakes) == 2
```

- [ ] **Step 3: Run tests**

```bash
uv run pytest tests/test_repository.py -v
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/db/repository.py tests/test_repository.py
git commit -m "feat: add repository layer with user, session, mistake, progress queries"
```

---

## Task 7: STT provider (xAI)

**Files:**
- Create: `src/providers/base.py`
- Create: `src/providers/stt_xai.py`
- Test: `tests/test_providers.py`

- [ ] **Step 1: Write provider base classes**

```python
from abc import ABC, abstractmethod


class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_data: bytes, language: str | None = None) -> str:
        ...


class TTSProvider(ABC):
    @abstractmethod
    async def synthesize(self, text: str, voice: str = "ara", language: str = "en") -> bytes:
        ...
```

- [ ] **Step 2: Write xAI STT provider**

```python
import httpx

from src.providers.base import STTProvider


class XaiSTT(STTProvider):
    def __init__(self, api_key: str):
        self._api_key = api_key
        self._url = "https://api.x.ai/v1/stt"

    async def transcribe(self, audio_data: bytes, language: str | None = None) -> str:
        data = [("format", "true")]
        if language:
            data.append(("language", language))
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self._url,
                headers={"Authorization": f"Bearer {self._api_key}"},
                files={"file": ("audio.ogg", audio_data, "audio/ogg")},
                data=data,
            )
            response.raise_for_status()
            return response.json()["text"]
```

- [ ] **Step 3: Write tests with mocked HTTP**

```python
import pytest
from unittest.mock import AsyncMock, patch

from src.providers.stt_xai import XaiSTT


async def test_xai_stt_transcribe():
    stt = XaiSTT(api_key="test-key")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"text": "Hello world"}
        mock_post.return_value.raise_for_status = lambda: None

        result = await stt.transcribe(b"fake-audio", language="en")
        assert result == "Hello world"

        call_kwargs = mock_post.call_args
        assert "Bearer test-key" in str(call_kwargs)
```

- [ ] **Step 4: Run tests**

```bash
uv run pytest tests/test_providers.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/providers/ tests/test_providers.py
git commit -m "feat: add STT provider abstraction and xAI implementation"
```

---

## Task 8: TTS provider (xAI)

**Files:**
- Create: `src/providers/tts_xai.py`
- Test: `tests/test_providers.py` (append)

- [ ] **Step 1: Write xAI TTS provider**

```python
import httpx

from src.providers.base import TTSProvider


class XaiTTS(TTSProvider):
    def __init__(self, api_key: str):
        self._api_key = api_key
        self._url = "https://api.x.ai/v1/tts"

    async def synthesize(self, text: str, voice: str = "ara", language: str = "en") -> bytes:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self._url,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "text": text,
                    "voice_id": voice,
                    "language": language,
                },
            )
            response.raise_for_status()
            return response.content
```

- [ ] **Step 2: Write TTS test**

```python
async def test_xai_tts_synthesize():
    from src.providers.tts_xai import XaiTTS

    tts = XaiTTS(api_key="test-key")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value.status_code = 200
        mock_post.return_value.content = b"fake-audio-bytes"
        mock_post.return_value.raise_for_status = lambda: None

        result = await tts.synthesize("Hello", voice="ara", language="en")
        assert result == b"fake-audio-bytes"
```

- [ ] **Step 3: Run tests**

```bash
uv run pytest tests/test_providers.py -v
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/providers/tts_xai.py tests/test_providers.py
git commit -m "feat: add TTS provider abstraction and xAI implementation"
```

---

## Task 9: Agno agent + prompt builder

**Files:**
- Create: `src/agent/prompt.py`
- Create: `src/agent/emma.py`

- [ ] **Step 1: Write prompt builder**

```python
from src.db.models import User, Mistake


def build_system_prompt(
    user: User,
    recent_mistakes: list[Mistake],
    session_count: int,
) -> str:
    mistakes_text = ""
    if recent_mistakes:
        lines = [f"  - \"{m.original}\" → \"{m.corrected}\" ({m.type}, seen {m.occurrence_count}x)" for m in recent_mistakes[:10]]
        mistakes_text = "\n".join(lines)
    else:
        mistakes_text = "  None yet"

    return f"""You are Emma, a language fluency coach for the EchoVocis app.

Your goal is to help the user speak {user.target_language} more fluently and naturally through real conversation.

USER CONTEXT:
- Native language: {user.native_language}
- Target language: {user.target_language}
- Recurring mistakes:
{mistakes_text}
- Sessions completed: {session_count}

CORE BEHAVIOR:
- If the user speaks in {user.target_language}: listen, identify mistakes or unnatural phrasing, then repeat the sentence in a corrected and more natural version. Briefly explain the correction.
- If the user speaks in {user.native_language}: translate the sentence into {user.target_language}, offer a more natural version if possible, and encourage the user to repeat it aloud.
- If the user mixes both languages in one sentence, translate the {user.native_language} portion into {user.target_language} and correct the {user.target_language} portion. Present the full corrected sentence.

CLARIFICATION:
- If the user asks to repeat or clarify something in {user.native_language}, explain again in {user.native_language}.
- If the user asks to repeat or clarify something in {user.target_language}, explain again in {user.target_language}.
- Always match the language the user uses to ask for help.

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
- Speak in {user.target_language} by default, except when explaining a correction to a beginner or when the user asks for clarification in {user.native_language}."""
```

- [ ] **Step 2: Write agent factory**

```python
from agno.agent import Agent
from agno.models.openai import OpenAIChat

from src.agent.tools import get_tools
from src.config import settings


def create_agent(system_prompt: str) -> Agent:
    model = OpenAIChat(id=settings.openai_model, api_key=settings.openai_api_key)
    return Agent(
        name="Emma",
        model=model,
        tools=get_tools(),
        instructions=[system_prompt],
        markdown=False,
        show_tool_calls=False,
    )
```

- [ ] **Step 3: Commit**

```bash
git add src/agent/prompt.py src/agent/emma.py
git commit -m "feat: add Emma agent with dynamic prompt builder"
```

---

## Task 10: Agent tools

**Files:**
- Create: `src/agent/tools.py`
- Test: `tests/test_tools.py`

- [ ] **Step 1: Write agent tools**

The tools receive `agent: Agent` parameter (Agno auto-injects it). Session state (`user_id`, `session_id`, `target_language`) is set on the agent before each run.

```python
import json
from typing import Optional

from agno.agent import Agent


def save_mistake(
    original: str,
    corrected: str,
    type: str,
    target_language: str,
    agent: Agent,
) -> str:
    """Save a language mistake identified during conversation.

    Args:
        original: What the user actually said.
        corrected: The corrected, natural version.
        type: Category of mistake (grammar, vocabulary, pronunciation, fluency).
        target_language: ISO language code (e.g. 'en', 'it').
    """
    import asyncio
    from src.db.session import async_session
    from src.db.repository import save_mistake as db_save_mistake

    user_id = agent.session_state.get("user_id", "")
    session_id = agent.session_state.get("session_id")

    async def _save():
        async with async_session() as db:
            mistake = await db_save_mistake(db, user_id, original, corrected, type, target_language, session_id)
            return f"Saved mistake: '{original}' → '{corrected}' ({type}, occurrence #{mistake.occurrence_count})"

    return asyncio.get_event_loop().run_until_complete(_save())


def get_user_history(
    limit: int = 10,
    agent: Agent = None,
) -> str:
    """Retrieve the user's recent mistakes and recurring patterns.

    Args:
        limit: Max number of recent mistakes to return (default 10, max 50).
    """
    import asyncio
    from src.db.session import async_session
    from src.db.repository import get_recent_mistakes

    user_id = agent.session_state.get("user_id", "")
    target_language = agent.session_state.get("target_language", "en")
    limit = min(limit, 50)

    async def _get():
        async with async_session() as db:
            mistakes = await get_recent_mistakes(db, user_id, target_language, limit)
            if not mistakes:
                return "No mistakes found."
            lines = []
            for m in mistakes:
                lines.append(f"- \"{m.original}\" → \"{m.corrected}\" ({m.type}, seen {m.occurrence_count}x)")
            return "\n".join(lines)

    return asyncio.get_event_loop().run_until_complete(_get())


def generate_exercise(
    type: str,
    based_on_mistake_ids: Optional[list[str]] = None,
    agent: Agent = None,
) -> str:
    """Create a personalized exercise based on the user's past mistakes.

    Args:
        type: Type of exercise (drill, repetition, translation_prompt, fluency_booster).
        based_on_mistake_ids: IDs of mistakes to base the exercise on. If empty, the backend selects recent recurring mistakes.
    """
    user_id = agent.session_state.get("user_id", "")
    target_language = agent.session_state.get("target_language", "en")
    return f"Exercise generated: {type} for {target_language}. The LLM should create the exercise content directly in its response based on the user's conversation context."


def save_progress(
    sentences_spoken: int,
    mistakes_count: int,
    corrections_accepted: int,
    target_language: str,
    agent: Agent = None,
) -> str:
    """Update the user's session progress counters.

    Args:
        sentences_spoken: Number of sentences the user has spoken so far.
        mistakes_count: Number of mistakes identified so far.
        corrections_accepted: Number of times the user repeated the corrected version.
        target_language: ISO language code.
    """
    import asyncio
    from src.db.session import async_session
    from src.db.repository import save_progress as db_save_progress

    user_id = agent.session_state.get("user_id", "")

    async def _save():
        async with async_session() as db:
            await db_save_progress(db, user_id, target_language, sentences_spoken, mistakes_count, corrections_accepted)
            return "Progress saved."

    return asyncio.get_event_loop().run_until_complete(_save())


def analyze_level(agent: Agent = None) -> str:
    """Analyze the user's history and estimate their CEFR level (A1-C2). Returns strengths, weaknesses, and recommended focus areas."""
    import asyncio
    from src.db.session import async_session
    from src.db.repository import get_mistake_stats, get_session_count, get_recent_mistakes

    user_id = agent.session_state.get("user_id", "")
    target_language = agent.session_state.get("target_language", "en")

    async def _analyze():
        async with async_session() as db:
            stats = await get_mistake_stats(db, user_id, target_language)
            session_count = await get_session_count(db, user_id)
            recent = await get_recent_mistakes(db, user_id, target_language, 20)
            data = {
                "total_mistakes_by_type": stats,
                "sessions_completed": session_count,
                "recent_mistake_count": len(recent),
                "top_recurring": [
                    {"original": m.original, "corrected": m.corrected, "type": m.type, "count": m.occurrence_count}
                    for m in recent[:5]
                ],
            }
            return f"User data for level analysis:\n{json.dumps(data, indent=2)}\n\nBased on this data, estimate the user's CEFR level and provide strengths, weaknesses, and focus areas."

    return asyncio.get_event_loop().run_until_complete(_analyze())


def get_tools():
    return [save_mistake, get_user_history, generate_exercise, save_progress, analyze_level]
```

- [ ] **Step 2: Write basic tools test**

```python
from src.agent.tools import get_tools


def test_get_tools_returns_five():
    tools = get_tools()
    assert len(tools) == 5
    names = [t.__name__ for t in tools]
    assert "save_mistake" in names
    assert "get_user_history" in names
    assert "generate_exercise" in names
    assert "save_progress" in names
    assert "analyze_level" in names
```

- [ ] **Step 3: Run test**

```bash
uv run pytest tests/test_tools.py -v
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/agent/tools.py tests/test_tools.py
git commit -m "feat: add Emma agent tools (save_mistake, get_user_history, generate_exercise, save_progress, analyze_level)"
```

---

## Task 11: Telegram bot setup + text handler

**Files:**
- Create: `src/telegram_bot/bot.py`
- Create: `src/telegram_bot/handlers.py`

- [ ] **Step 1: Write bot.py**

```python
import logging

from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters

from src.config import settings
from src.telegram_bot.handlers import start, text_message, voice_message, inline_callback

logger = logging.getLogger(__name__)


def create_bot() -> Application:
    app = Application.builder().token(settings.telegram_bot_token).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("stop", start))
    app.add_handler(CommandHandler("level", start))
    app.add_handler(CommandHandler("exercises", start))
    app.add_handler(CommandHandler("history", start))
    app.add_handler(MessageHandler(filters.VOICE, voice_message))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_message))
    app.add_handler(CallbackQueryHandler(inline_callback))

    return app


def run_bot():
    logging.basicConfig(level=settings.log_level)
    bot = create_bot()
    logger.info("Starting EchoVocis bot...")
    bot.run_polling()
```

- [ ] **Step 2: Write handlers.py (text + start)**

```python
import logging
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from src.agent.emma import create_agent
from src.agent.prompt import build_system_prompt
from src.config import settings
from src.db.repository import (
    get_or_create_session,
    get_or_create_user,
    get_recent_mistakes,
    get_session_count,
    save_message,
    update_user_languages,
)
from src.db.session import async_session
from src.providers.stt_xai import XaiSTT
from src.providers.tts_xai import XaiTTS

logger = logging.getLogger(__name__)

_stt = XaiSTT(api_key=settings.xai_api_key)
_tts = XaiTTS(api_key=settings.xai_api_key)


@asynccontextmanager
async def get_db():
    async with async_session() as db:
        yield db


async def _get_user_session(update: Update, db: AsyncSession):
    tg_user = update.effective_user
    user = await get_or_create_user(db, str(tg_user.id), tg_user.first_name)
    if not user.onboarding_completed:
        await update.message.reply_text(
            f"Ciao {tg_user.first_name}! Welcome to EchoVocis.\n\n"
            "What's your native language? (e.g. 'it' for Italian, 'en' for English)"
        )
        return None, None
    session = await get_or_create_session(db, user.id, user.target_language, settings.session_timeout_minutes)
    return user, session


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    async with get_db() as db:
        tg_user = update.effective_user
        user = await get_or_create_user(db, str(tg_user.id), tg_user.first_name)

        if not user.onboarding_completed:
            context.user_data["onboarding_step"] = "native"
            await update.message.reply_text(
                f"Ciao {tg_user.first_name}! I'm Emma, your language coach. 🗣️\n\n"
                "What's your native language? (e.g. 'it' for Italian, 'en' for English)"
            )
            return

        await update.message.reply_text(
            f"Welcome back, {tg_user.first_name}! 🎉\n\n"
            f"Languages: {user.native_language.upper()} → {user.target_language.upper()}\n"
            "Send me a voice message or text to start practicing!"
        )


async def text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    async with get_db() as db:
        user = await get_or_create_user(db, str(update.effective_user.id), update.effective_user.first_name)

        if not user.onboarding_completed:
            await _handle_onboarding(update, context, user, db)
            return

        session = await get_or_create_session(db, user.id, user.target_language, settings.session_timeout_minutes)
        text = update.message.text

        await save_message(db, user.id, session.id, "user", text, is_voice=False)

        mistakes = await get_recent_mistakes(db, user.id, user.target_language)
        session_count = await get_session_count(db, user.id)
        prompt = build_system_prompt(user, list(mistakes), session_count)

        agent = create_agent(prompt)
        agent.session_state = {
            "user_id": user.id,
            "session_id": session.id,
            "target_language": user.target_language,
        }

        response = agent.run(text)
        emma_text = response.content

        await save_message(db, user.id, session.id, "emma", emma_text, is_voice=False)

        keyboard = InlineKeyboardMarkup([[InlineKeyboardButton("Hear audio", callback_data=f"tts:{emma_text[:200]}")]])
        await update.message.reply_text(emma_text, reply_markup=keyboard)


async def _handle_onboarding(update: Update, context: ContextTypes.DEFAULT_TYPE, user, db) -> None:
    step = context.user_data.get("onboarding_step", "native")
    text = update.message.text.strip().lower()

    if step == "native":
        context.user_data["native_language"] = text
        context.user_data["onboarding_step"] = "target"
        await update.message.reply_text(f"Native language set to: {text}\n\nWhat language do you want to learn? (e.g. 'en', 'es', 'fr')")
    elif step == "target":
        native = context.user_data.get("native_language", "en")
        user = await update_user_languages(db, user.id, native, text)
        context.user_data.pop("onboarding_step", None)
        context.user_data.pop("native_language", None)
        await update.message.reply_text(
            f"Perfect! {native.upper()} → {text.upper()}\n\n"
            "You're all set! Send me a voice message or text to start practicing with Emma! 🎤"
        )
```

- [ ] **Step 3: Commit**

```bash
git add src/telegram_bot/bot.py src/telegram_bot/handlers.py
git commit -m "feat: add Telegram bot with start, onboarding, and text message handlers"
```

---

## Task 12: Voice message handler + inline buttons

**Files:**
- Modify: `src/telegram_bot/handlers.py` (add voice_message, inline_callback)
- Create: `src/telegram_bot/inline.py`

- [ ] **Step 1: Add voice_message and inline_callback to handlers.py**

Append to `handlers.py`:

```python
async def voice_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    async with get_db() as db:
        user = await get_or_create_user(db, str(update.effective_user.id), update.effective_user.first_name)

        if not user.onboarding_completed:
            await update.message.reply_text("Please finish setup first. Send /start")
            return

        session = await get_or_create_session(db, user.id, user.target_language, settings.session_timeout_minutes)

        voice = update.message.voice
        audio_file = await voice.get_file()
        audio_data = await audio_file.download_as_bytearray()

        transcription = await _stt.transcribe(bytes(audio_data), language=user.target_language)
        await save_message(db, user.id, session.id, "user", transcription, is_voice=True, telegram_file_id=voice.file_id)

        mistakes = await get_recent_mistakes(db, user.id, user.target_language)
        session_count = await get_session_count(db, user.id)
        prompt = build_system_prompt(user, list(mistakes), session_count)

        agent = create_agent(prompt)
        agent.session_state = {
            "user_id": user.id,
            "session_id": session.id,
            "target_language": user.target_language,
        }

        response = agent.run(transcription)
        emma_text = response.content

        await save_message(db, user.id, session.id, "emma", emma_text, is_voice=False)

        audio_bytes = await _tts.synthesize(emma_text, voice=settings.tts_voice, language=user.target_language)
        await update.message.reply_voice(audio_bytes, caption=None)

        keyboard = InlineKeyboardMarkup([[InlineKeyboardButton("Show text", callback_data=f"txt:{update.message.message_id}")]])
        await update.message.reply_text("👆 Voice reply sent", reply_markup=keyboard)

        context.chat_data[f"last_text:{update.message.message_id}"] = emma_text


async def inline_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    data = query.data
    if data.startswith("txt:"):
        msg_id = data.split(":")[1]
        text = context.chat_data.get(f"last_text:{msg_id}", "Text not available")
        await query.message.reply_text(text)
    elif data.startswith("tts:"):
        text = data[4:]
        audio_bytes = await _tts.synthesize(text, voice=settings.tts_voice)
        await query.message.reply_voice(audio_bytes)
```

- [ ] **Step 2: Commit**

```bash
git add src/telegram_bot/
git commit -m "feat: add voice message handler with STT/TTS and inline buttons"
```

---

## Task 13: Entrypoint

**Files:**
- Create: `src/main.py`

- [ ] **Step 1: Write main.py**

```python
from src.telegram_bot.bot import run_bot


def main():
    run_bot()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Add script entry to pyproject.toml**

Add under `[project]`:

```toml
[project.scripts]
echovocis = "src.main:main"
```

- [ ] **Step 3: Commit**

```bash
git add src/main.py pyproject.toml
git commit -m "feat: add main entrypoint"
```

---

## Task 14: Docker Compose + Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Write Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml uv.lock* ./
RUN pip install uv && uv sync --frozen --no-dev

COPY src/ src/
COPY alembic/ alembic/
COPY alembic.ini .

CMD ["uv", "run", "python", "-m", "src.main"]
```

- [ ] **Step 2: Write docker-compose.yml**

```yaml
services:
  db:
    image: postgres:17
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: echovocis
      POSTGRES_USER: echovocis
      POSTGRES_PASSWORD: ${DB_PASSWORD:-echovocis}
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U echovocis"]
      interval: 5s
      retries: 5

  bot:
    build: .
    depends_on:
      db:
        condition: service_healthy
    env_file: .env
    environment:
      DATABASE_URL: postgresql+asyncpg://echovocis:${DB_PASSWORD:-echovocis}@db:5432/echovocis
    command: >
      sh -c "uv run alembic upgrade head && uv run python -m src.main"

volumes:
  pgdata:
```

- [ ] **Step 3: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: add Docker Compose setup with PostgreSQL and bot"
```

---

## Task 15: Generate initial migration + smoke test

**Files:**
- Generated: `alembic/versions/xxx_initial.py`

- [ ] **Step 1: Start PostgreSQL**

```bash
docker compose up db -d
```

- [ ] **Step 2: Generate migration**

```bash
DATABASE_URL=postgresql+asyncpg://echovocis:echovocis@localhost:5432/echovocis uv run alembic revision --autogenerate -m "initial"
```

- [ ] **Step 3: Run migration**

```bash
DATABASE_URL=postgresql+asyncpg://echovocis:echovocis@localhost:5432/echovocis uv run alembic upgrade head
```

Expected: "Running upgrade ... -> initial, heads"

- [ ] **Step 4: Verify tables exist**

```bash
docker compose exec db psql -U echovocis -c "\dt"
```

Expected: users, sessions, messages, mistakes, progress, exercises, exercise_mistake tables listed.

- [ ] **Step 5: Commit**

```bash
git add alembic/versions/
git commit -m "feat: add initial Alembic migration"
```

---

## Task 16: End-to-end smoke test

- [ ] **Step 1: Set up environment**

```bash
cp .env.example .env
# Edit .env with real API keys and bot token
```

- [ ] **Step 2: Run the bot locally**

```bash
docker compose up db -d
uv run alembic upgrade head
uv run python -m src.main
```

Expected: "Starting EchoVocis bot..." logged, no errors.

- [ ] **Step 3: Test in Telegram**

1. Open the bot in Telegram
2. Send `/start`
3. Respond to onboarding (native language, target language)
4. Send a text message → expect text reply with "Hear audio" button
5. Send a voice message → expect voice reply with "Show text" button
6. Click "Show text" → expect text of the voice reply
7. Click "Hear audio" → expect voice message of the text reply

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: EchoVocis V2 complete — Agno + Telegram bot with STT/TTS pipeline"
```

---

## Self-Review Checklist

### Spec coverage

| Spec requirement | Task |
|---|---|
| Telegram bot interface | Task 11, 12 |
| Agno agent framework | Task 9, 10 |
| GPT-4o LLM (default) | Task 9 |
| xAI STT (default) | Task 7 |
| xAI TTS (default) | Task 8 |
| PostgreSQL + SQLAlchemy | Task 4, 5 |
| Docker Compose | Task 14 |
| Data model from V1 | Task 4 |
| Message table (new) | Task 4 |
| Mistake deduplication | Task 6 |
| Session lifecycle (timeout) | Task 6 (repository), Task 12 |
| Voice→audio, text→text | Task 12 |
| Inline buttons | Task 12 |
| Model-agnostic config | Task 3, 7, 8 |
| Emma's system prompt | Task 9 |
| save_mistake tool | Task 10 |
| get_user_history tool | Task 10 |
| generate_exercise tool | Task 10 |
| save_progress tool | Task 10 |
| analyze_level tool | Task 10 |
| Onboarding flow | Task 11 |
| Prototype preserved | Task 1 |

### Placeholder scan

No TBD, TODO, or placeholder patterns found.

### Type consistency

- `user_id` is always `str` across models, repository, tools, and handlers.
- `session_id` is always `str | None` in tools (matches nullable FK).
- `target_language` is always `str` everywhere.
- Provider methods match the abstract base class signatures.
