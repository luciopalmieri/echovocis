import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from src.db.models import Base, Session, Progress
from src.db.repository import (
    get_or_create_user,
    save_mistake,
    get_recent_mistakes,
    get_or_create_session,
    save_progress,
)


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


async def test_get_or_create_session_creates_new(db):
    user = await get_or_create_user(db, "tg_123")
    session = await get_or_create_session(db, user.id, "it")
    assert session.user_id == user.id
    assert session.target_language == "it"
    assert session.ended_at is None


async def test_get_or_create_session_returns_existing_within_timeout(db):
    user = await get_or_create_user(db, "tg_123")
    s1 = await get_or_create_session(db, user.id, "it")
    s2 = await get_or_create_session(db, user.id, "it")
    assert s1.id == s2.id


async def test_get_or_create_session_expires_old(db):
    user = await get_or_create_user(db, "tg_123")
    s1 = await get_or_create_session(db, user.id, "it")
    s1.started_at = datetime.now(timezone.utc) - timedelta(minutes=30)
    await db.flush()
    s2 = await get_or_create_session(db, user.id, "it")
    await db.refresh(s1)
    assert s1.ended_at is not None
    assert s2.id != s1.id
    assert s2.ended_at is None


async def test_save_progress_creates_new_with_streak_one(db):
    user = await get_or_create_user(db, "tg_123")
    progress = await save_progress(db, user.id, "it", 5, 2, 1)
    assert progress.sentences_spoken == 5
    assert progress.mistakes_count == 2
    assert progress.corrections_accepted == 1
    assert progress.streak_days == 1


async def test_save_progress_updates_existing_same_day(db):
    user = await get_or_create_user(db, "tg_123")
    p1 = await save_progress(db, user.id, "it", 5, 2, 1)
    p2 = await save_progress(db, user.id, "it", 10, 4, 3)
    assert p1.id == p2.id
    assert p2.sentences_spoken == 10
    assert p2.mistakes_count == 4
    assert p2.corrections_accepted == 3
