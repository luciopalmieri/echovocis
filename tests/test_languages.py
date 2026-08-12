from telegram import InlineKeyboardMarkup

from src.telegram_bot.languages import (
    SUPPORTED_LANGUAGES,
    LanguageInfo,
    build_confirm_keyboard,
    build_lang_callback,
    build_native_keyboard,
    build_target_keyboard,
    is_supported_language,
    parse_lang_callback,
)


def test_supported_languages_contains_expected_set():
    assert set(SUPPORTED_LANGUAGES.keys()) == {"it", "en", "de", "fr", "es", "zh"}
    info = SUPPORTED_LANGUAGES["zh"]
    assert isinstance(info, LanguageInfo)
    assert info.label == "中文"
    assert info.flag == "🇨🇳"


def test_is_supported_language_accepts_known_rejects_unknown():
    assert is_supported_language("en") is True
    assert is_supported_language("a random sentence") is False
    assert is_supported_language("") is False
    assert is_supported_language("EN") is False  # codes are lowercase only


def test_build_and_parse_native_callback_round_trip():
    data = build_lang_callback("native", native="it")
    assert data == "lang_native:it"
    parsed = parse_lang_callback(data)
    assert parsed == ("native", "it", None)


def test_build_and_parse_target_callback_round_trip():
    data = build_lang_callback("target", native="it", target="en")
    assert data == "lang_target:it:en"
    parsed = parse_lang_callback(data)
    assert parsed == ("target", "it", "en")


def test_build_and_parse_confirm_callback_round_trip():
    data = build_lang_callback("confirm", native="it", target="en")
    assert data == "lang_confirm:it:en"
    parsed = parse_lang_callback(data)
    assert parsed == ("confirm", "it", "en")


def test_parse_callback_returns_none_for_non_lang_data():
    assert parse_lang_callback("tts:123") is None
    assert parse_lang_callback("txt:abc") is None
    assert parse_lang_callback("not a callback at all") is None
    assert parse_lang_callback("") is None


def test_parse_callback_returns_none_for_invalid_lang_code():
    assert parse_lang_callback("lang_native:xx") is None
    assert parse_lang_callback("lang_target:it:xx") is None
    assert parse_lang_callback("lang_bogus:it") is None


def test_restart_callback_round_trip():
    data = build_lang_callback("restart")
    assert data == "lang_restart"
    assert parse_lang_callback("lang_restart") == ("restart", None, None)
    assert parse_lang_callback("lang_restart:extra") is None


def _flatten(markup: InlineKeyboardMarkup) -> list[dict]:
    rows = markup.to_dict()["inline_keyboard"]
    return [btn for row in rows for btn in row]


def test_native_keyboard_has_button_per_language():
    markup = build_native_keyboard()
    assert isinstance(markup, InlineKeyboardMarkup)
    buttons = _flatten(markup)
    assert len(buttons) == len(SUPPORTED_LANGUAGES)
    codes = {b["callback_data"].split(":")[1] for b in buttons}
    assert codes == set(SUPPORTED_LANGUAGES.keys())


def test_target_keyboard_excludes_native_to_prevent_same_language():
    markup = build_target_keyboard(native="it")
    buttons = _flatten(markup)
    codes = []
    for b in buttons:
        assert b["callback_data"].startswith("lang_target:it:")
        codes.append(b["callback_data"].split(":")[2])
    assert "it" not in codes, "native language must not appear as a target option"
    assert set(codes) == set(SUPPORTED_LANGUAGES.keys()) - {"it"}


def test_confirm_keyboard_emits_confirm_retry_and_back_callbacks():
    markup = build_confirm_keyboard(native="it", target="en")
    buttons = _flatten(markup)
    datas = {b["callback_data"] for b in buttons}
    # Confirm persists the chosen pair
    assert "lang_confirm:it:en" in datas
    # Retry regenerates the preview for the same pair
    assert "lang_target:it:en" in datas
    # Back returns to the target picker (which re-renders target options for this native)
    assert "lang_native:it" in datas
