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
