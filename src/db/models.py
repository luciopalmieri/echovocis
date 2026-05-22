from datetime import datetime, timezone

from cuid2 import cuid_wrapper
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Table, Text, UniqueConstraint
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
