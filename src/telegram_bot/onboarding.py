from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Protocol

from src.telegram_bot.languages import (
    SUPPORTED_LANGUAGES,
    build_confirm_keyboard,
    build_native_keyboard,
    build_target_keyboard,
)


class Responder(Protocol):
    async def text(self, text: str, reply_markup=None) -> None: ...
    async def voice(self, audio: bytes, caption: str | None = None, reply_markup=None) -> None: ...
    async def edit(self, text: str, reply_markup=None) -> None: ...


@dataclass
class OnboardingDeps:
    responder: Responder
    tts: object
    tts_voice: str
    greeter: Callable[[str], Awaitable[str]]
    persist: Callable[[str, str], Awaitable[None]]


def _label(code: str) -> str:
    info = SUPPORTED_LANGUAGES.get(code)
    if info is None:
        return f'⚠️ "{code}"'
    return f"{info.flag} {info.label}"


async def synthesize_voice_or_none(tts, text: str, voice: str, language: str) -> bytes | None:
    try:
        return await tts.synthesize(text, voice=voice, language=language)
    except Exception:  # noqa: BLE001 - degrade gracefully when a language is not supported for voice
        return None


async def start_native_picker(responder: Responder) -> None:
    await responder.text(
        "Cominciamo scegliendo la tua lingua madre 🗣️\n\nQuale è la tua lingua madre?",
        reply_markup=build_native_keyboard(),
    )


async def show_languages_status(responder: Responder, native: str, target: str) -> None:
    await responder.text(
        f"Lingue attuali: {_label(native)} → {_label(target)}\n\nVuoi cambiarle?",
        reply_markup=build_change_keyboard(),
    )


def build_change_keyboard():
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup

    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("🔄 Cambia lingue", callback_data="lang_restart")]]
    )


async def handle_lang_action(action: str, native: str | None, target: str | None, *, deps: OnboardingDeps) -> None:
    if action == "restart":
        await start_native_picker(deps.responder)
        return

    if action == "native":
        await deps.responder.edit(
            f"Lingua madre: {_label(native)}.\n\nQuale lingua vuoi imparare?",
            reply_markup=build_target_keyboard(native),
        )
        return

    if action == "target":
        greeting = await deps.greeter(target)
        audio = await synthesize_voice_or_none(deps.tts, greeting, deps.tts_voice, target)
        if audio is None:
            await deps.responder.text(
                f"🔇 Voce non disponibile per {_label(target)}. Scegline un'altra.",
                reply_markup=build_target_keyboard(native),
            )
            return
        await deps.responder.voice(audio, caption=greeting, reply_markup=build_confirm_keyboard(native, target))
        return

    if action == "confirm":
        await deps.persist(native, target)
        await deps.responder.text(
            f"Tutto pronto! {_label(native)} → {_label(target)}\n\n"
            "Invia un messaggio vocale o di testo per iniziare con Emma! 🎤"
        )
        return
