import asyncio
import logging
from contextlib import asynccontextmanager

from openai import OpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.error import TimedOut
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
from src.telegram_bot.help import build_help_message
from src.telegram_bot.languages import SUPPORTED_LANGUAGES, parse_lang_callback
from src.telegram_bot.onboarding import (
    OnboardingDeps,
    Responder,
    handle_lang_action,
    show_languages_status,
    start_native_picker,
)

logger = logging.getLogger(__name__)

_stt = XaiSTT(api_key=settings.xai_api_key)
_tts = XaiTTS(api_key=settings.xai_api_key)

_PRIVATE_MSG = "This is a private service. Authorization is required to use this bot. Please contact the owner for access."


def _is_allowed(update: Update) -> bool:
    return settings.is_telegram_allowed(str(update.effective_user.id))


@asynccontextmanager
async def get_db():
    async with async_session() as db:
        yield db


class _MessageResponder(Responder):
    def __init__(self, message):
        self._m = message

    async def text(self, text, reply_markup=None):
        await self._m.reply_text(text, reply_markup=reply_markup)

    async def voice(self, audio, caption=None, reply_markup=None):
        await self._m.reply_voice(audio, caption=caption, reply_markup=reply_markup)

    async def edit(self, text, reply_markup=None):
        await self._m.reply_text(text, reply_markup=reply_markup)


class _CallbackResponder(Responder):
    def __init__(self, query):
        self._q = query

    async def text(self, text, reply_markup=None):
        await self._q.message.reply_text(text, reply_markup=reply_markup)

    async def voice(self, audio, caption=None, reply_markup=None):
        await self._q.message.reply_voice(audio, caption=caption, reply_markup=reply_markup)

    async def edit(self, text, reply_markup=None):
        try:
            await self._q.edit_message_text(text, reply_markup=reply_markup)
        except Exception:  # noqa: BLE001 - fall back to a new message if editing fails
            await self._q.message.reply_text(text, reply_markup=reply_markup)


_openai_client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None


def _greet_sync(target: str) -> str:
    info = SUPPORTED_LANGUAGES[target]
    fallback = "Hi! 👋"
    if _openai_client is None:
        return fallback
    try:
        resp = _openai_client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Say a single short, warm, friendly greeting in {info.label} "
                        f"to a language learner. Reply with just the greeting sentence, nothing else."
                    ),
                }
            ],
        )
        return (resp.choices[0].message.content or fallback).strip() or fallback
    except Exception:  # noqa: BLE001 - greeting is non-critical; fall back to a default
        return fallback


async def _default_greeter(target: str) -> str:
    return await asyncio.to_thread(_greet_sync, target)


def _make_persist(db: AsyncSession, user_id: str):
    async def persist(native: str, target: str) -> None:
        await update_user_languages(db, user_id, native, target)

    return persist


def _onboarding_deps(responder: Responder, db: AsyncSession, user_id: str) -> OnboardingDeps:
    return OnboardingDeps(
        responder=responder,
        tts=_tts,
        tts_voice=settings.tts_voice,
        greeter=_default_greeter,
        persist=_make_persist(db, user_id),
    )


async def _ensure_onboarded(update: Update, user) -> bool:
    if user.onboarding_completed:
        return True
    await start_native_picker(_MessageResponder(update.message))
    return False


async def _fetch_voice_bytes(voice) -> bytes | None:
    """Download a voice message, retrying once on network timeout.

    Returns the audio bytes, or None if the download timed out twice so the
    caller can tell the user to retry instead of failing silently.
    """
    for attempt in (1, 2):
        try:
            audio_file = await voice.get_file()
            return bytes(await audio_file.download_as_bytearray())
        except TimedOut:
            logger.warning("Voice download timed out (attempt %d/2)", attempt)
    return None


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update):
        await update.message.reply_text(_PRIVATE_MSG)
        return
    async with get_db() as db:
        tg_user = update.effective_user
        user = await get_or_create_user(db, str(tg_user.id), tg_user.first_name)
        responder = _MessageResponder(update.message)

        if not user.onboarding_completed:
            await start_native_picker(responder)
            return

        await responder.text(
            f"Welcome back, {tg_user.first_name}! 🎉\n\n"
            f"Languages: {user.native_language.upper()} → {user.target_language.upper()}\n"
            "Send me a voice message or text to start practicing!"
        )


async def language(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update):
        await update.message.reply_text(_PRIVATE_MSG)
        return
    async with get_db() as db:
        tg_user = update.effective_user
        user = await get_or_create_user(db, str(tg_user.id), tg_user.first_name)
        responder = _MessageResponder(update.message)

        if not user.onboarding_completed:
            await start_native_picker(responder)
            return

        await show_languages_status(responder, user.native_language, user.target_language)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update):
        await update.message.reply_text(_PRIVATE_MSG)
        return
    async with get_db() as db:
        user = await get_or_create_user(db, str(update.effective_user.id), update.effective_user.first_name)
        native = user.native_language if user.onboarding_completed else None
        await update.message.reply_text(build_help_message(native))


async def text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update):
        await update.message.reply_text(_PRIVATE_MSG)
        return
    async with get_db() as db:
        user = await get_or_create_user(db, str(update.effective_user.id), update.effective_user.first_name)

        if not await _ensure_onboarded(update, user):
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
        emma_text = response.content

        await save_message(db, user.id, session.id, "emma", emma_text, is_voice=False)

        context.chat_data[f"last_text:{update.message.message_id}"] = emma_text
        context.chat_data["target_language"] = user.target_language
        keyboard = InlineKeyboardMarkup([[InlineKeyboardButton("Hear audio", callback_data=f"tts:{update.message.message_id}")]])
        await update.message.reply_text(emma_text, reply_markup=keyboard)


async def voice_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update):
        await update.message.reply_text(_PRIVATE_MSG)
        return
    async with get_db() as db:
        user = await get_or_create_user(db, str(update.effective_user.id), update.effective_user.first_name)

        if not await _ensure_onboarded(update, user):
            return

        session = await get_or_create_session(db, user.id, user.target_language, settings.session_timeout_minutes)

        voice = update.message.voice
        audio_data = await _fetch_voice_bytes(voice)
        if audio_data is None:
            await update.message.reply_text(
                "⏳ I couldn't download your voice message in time (network timeout). Please try again."
            )
            return

        transcription = await _stt.transcribe(audio_data, language=user.target_language)
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
        emma_text = response.content

        await save_message(db, user.id, session.id, "emma", emma_text, is_voice=False)

        audio_bytes = await _tts.synthesize(emma_text, voice=settings.tts_voice, language=user.target_language)

        context.chat_data[f"last_text:{update.message.message_id}"] = emma_text
        context.chat_data["target_language"] = user.target_language
        keyboard = InlineKeyboardMarkup([[InlineKeyboardButton("Show text", callback_data=f"txt:{update.message.message_id}")]])
        await update.message.reply_voice(audio_bytes, reply_markup=keyboard)


async def inline_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    data = query.data

    parsed = parse_lang_callback(data)
    if parsed is not None:
        action, native, target = parsed
        async with get_db() as db:
            tg_user = update.effective_user
            user = await get_or_create_user(db, str(tg_user.id), tg_user.first_name)
            deps = _onboarding_deps(_CallbackResponder(query), db, user.id)
            await handle_lang_action(action, native, target, deps=deps)
        return

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


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.error("Unhandled exception while handling an update", exc_info=context.error)
    chat = getattr(update, "effective_chat", None) if update is not None else None
    if chat is not None:
        try:
            await context.bot.send_message(
                chat.id,
                "⚠️ Something went wrong while processing your message. Please try again.",
            )
        except Exception:  # noqa: BLE001, S110 - the error handler must never crash
            pass
