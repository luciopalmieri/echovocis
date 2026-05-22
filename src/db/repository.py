from datetime import datetime, timezone, timedelta
from typing import Sequence

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User, Session, Message, Mistake, Progress


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
    if session is not None and session.started_at.replace(tzinfo=None) >= cutoff.replace(tzinfo=None):
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
            Mistake.user_id == user_id,
            Mistake.target_language == target_language,
            Mistake.original == original,
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
            Progress.user_id == user_id,
            Progress.target_language == target_language,
            Progress.date == today,
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
            Progress.user_id == user_id,
            Progress.target_language == target_language,
            Progress.date == yesterday,
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


async def get_mistake_stats(db: AsyncSession, user_id: str, target_language: str) -> dict[str, int]:
    result = await db.execute(
        select(Mistake.type, func.count().label("count"))
        .where(Mistake.user_id == user_id, Mistake.target_language == target_language)
        .group_by(Mistake.type)
    )
    return {row[0]: row[1] for row in result.all()}
