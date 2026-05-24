import asyncio
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


_PRIVATE_MSG = "This is a private service. Authorization is required to use this bot. Please contact the owner for access."


def _is_allowed(update: Update) -> bool:
    if settings.is_telegram_allowed(str(update.effective_user.id)):
        return True
    return False


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
    if not _is_allowed(update):
        await update.message.reply_text(_PRIVATE_MSG)
        return
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
    if not _is_allowed(update):
        await update.message.reply_text(_PRIVATE_MSG)
        return
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

        response = await asyncio.to_thread(agent.run, text)
        logger.info(f"Agent response: tools_used={getattr(response, 'tools', None)} messages={len(response.messages) if hasattr(response, 'messages') else '?'}")
        for msg in getattr(response, 'messages', []) or []:
            logger.info(f"  Agent message: role={getattr(msg, 'role', '?')} tool_calls={getattr(msg, 'tool_calls', None)} content_preview={str(getattr(msg, 'content', ''))[:150]}")
        emma_text = response.content

        await save_message(db, user.id, session.id, "emma", emma_text, is_voice=False)

        context.chat_data[f"last_text:{update.message.message_id}"] = emma_text
        context.chat_data["target_language"] = user.target_language
        keyboard = InlineKeyboardMarkup([[InlineKeyboardButton("Hear audio", callback_data=f"tts:{update.message.message_id}")]])
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
    if not _is_allowed(update):
        await update.message.reply_text(_PRIVATE_MSG)
        return
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

        response = await asyncio.to_thread(agent.run, transcription)
        logger.info(f"Agent response: tools_used={getattr(response, 'tools', None)} messages={len(response.messages) if hasattr(response, 'messages') else '?'}")
        for msg in getattr(response, 'messages', []) or []:
            logger.info(f"  Agent message: role={getattr(msg, 'role', '?')} tool_calls={getattr(msg, 'tool_calls', None)} content_preview={str(getattr(msg, 'content', ''))[:150]}")
        emma_text = response.content

        await save_message(db, user.id, session.id, "emma", emma_text, is_voice=False)

        audio_bytes = await _tts.synthesize(emma_text, voice=settings.tts_voice, language=user.target_language)
        await update.message.reply_voice(audio_bytes, caption=None)

        context.chat_data[f"last_text:{update.message.message_id}"] = emma_text
        context.chat_data["target_language"] = user.target_language
        keyboard = InlineKeyboardMarkup([[InlineKeyboardButton("Show text", callback_data=f"txt:{update.message.message_id}")]])
        await update.message.reply_text("👆 Voice reply sent", reply_markup=keyboard)


async def inline_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    data = query.data
    target_language = context.chat_data.get("target_language", "en")
    if data.startswith("txt:"):
        msg_id = data.split(":")[1]
        text = context.chat_data.get(f"last_text:{msg_id}", "Text not available")
        await query.message.reply_text(text)
    elif data.startswith("tts:"):
        msg_id = data.split(":")[1]
        text = context.chat_data.get(f"last_text:{msg_id}", "Text not available")
        if text != "Text not available":
            audio_bytes = await _tts.synthesize(text, voice=settings.tts_voice, language=target_language)
            await query.message.reply_voice(audio_bytes)
