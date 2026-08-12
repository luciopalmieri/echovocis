from dataclasses import dataclass

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

_LANG_ACTIONS = ("native", "target", "confirm", "restart")


@dataclass(frozen=True)
class LanguageInfo:
    code: str
    label: str
    flag: str


SUPPORTED_LANGUAGES: dict[str, LanguageInfo] = {
    "it": LanguageInfo("it", "Italiano", "🇮🇹"),
    "en": LanguageInfo("en", "English", "🇬🇧"),
    "de": LanguageInfo("de", "Deutsch", "🇩🇪"),
    "fr": LanguageInfo("fr", "Français", "🇫🇷"),
    "es": LanguageInfo("es", "Español", "🇪🇸"),
    "zh": LanguageInfo("zh", "中文", "🇨🇳"),
}


def is_supported_language(code: str) -> bool:
    return code in SUPPORTED_LANGUAGES


def build_lang_callback(action: str, native: str | None = None, target: str | None = None) -> str:
    if action == "restart":
        return "lang_restart"
    if action == "native":
        return f"lang_native:{native}"
    return f"lang_{action}:{native}:{target}"


def parse_lang_callback(data: str) -> tuple[str, str | None, str | None] | None:
    if not isinstance(data, str) or not data.startswith("lang_"):
        return None
    kind, _, payload = data.partition(":")
    action = kind[len("lang_"):]
    if action not in _LANG_ACTIONS:
        return None
    if action == "restart":
        return ("restart", None, None) if payload == "" else None
    parts = payload.split(":")
    if action == "native":
        if len(parts) != 1:
            return None
        native = parts[0]
        if not is_supported_language(native):
            return None
        return (action, native, None)
    if len(parts) != 2:
        return None
    native, target = parts
    if not is_supported_language(native) or not is_supported_language(target):
        return None
    return (action, native, target)


def _button(code: str) -> InlineKeyboardButton:
    info = SUPPORTED_LANGUAGES[code]
    return InlineKeyboardButton(f"{info.flag} {info.label}", callback_data=build_lang_callback("native", code))


def build_native_keyboard() -> InlineKeyboardMarkup:
    codes = list(SUPPORTED_LANGUAGES.keys())
    rows = [codes[i:i + 2] for i in range(0, len(codes), 2)]
    keyboard = [[_button(c) for c in row] for row in rows]
    return InlineKeyboardMarkup(keyboard)


def build_target_keyboard(native: str) -> InlineKeyboardMarkup:
    codes = [c for c in SUPPORTED_LANGUAGES if c != native]
    rows = [codes[i:i + 2] for i in range(0, len(codes), 2)]
    keyboard = [
        [
            InlineKeyboardButton(
                f"{SUPPORTED_LANGUAGES[c].flag} {SUPPORTED_LANGUAGES[c].label}",
                callback_data=build_lang_callback("target", native, c),
            )
            for c in row
        ]
        for row in rows
    ]
    return InlineKeyboardMarkup(keyboard)


def build_confirm_keyboard(native: str, target: str) -> InlineKeyboardMarkup:
    keyboard = [
        [
            InlineKeyboardButton("✅ Conferma", callback_data=build_lang_callback("confirm", native, target)),
            InlineKeyboardButton("🔄 Riprova", callback_data=build_lang_callback("target", native, target)),
        ],
        [InlineKeyboardButton("↩️ Cambia lingua", callback_data=build_lang_callback("native", native))],
    ]
    return InlineKeyboardMarkup(keyboard)
