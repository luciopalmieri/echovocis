from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from src.config import settings

# NullPool: each session checks out a fresh connection on its own event loop.
# The agent runs in a worker thread (asyncio.to_thread) and its tools spawn
# their own loops via asyncio.run(); a shared connection pool would reuse
# asyncpg connections across loops, triggering
# "cannot perform operation: another operation is in progress".
engine = create_async_engine(settings.database_url, echo=settings.app_env == "development", poolclass=NullPool)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
