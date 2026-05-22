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
