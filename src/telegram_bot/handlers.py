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


async def voice_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text("Voice messages coming soon!")


async def inline_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    await query.message.reply_text("Feature coming soon!")
