from src.telegram_bot.help import HELP_LANGUAGES, build_help_message
from src.telegram_bot.languages import SUPPORTED_LANGUAGES


def test_help_defaults_to_english_for_no_native():
    text = build_help_message(None)
    assert "EchoVocis" in text
    for cmd in ("/start", "/language", "/help"):
        assert cmd in text


def test_help_falls_back_to_english_for_invalid_legacy_code():
    assert build_help_message("are you funzionando?") == build_help_message(None)


def test_help_has_text_for_every_supported_language():
    assert set(HELP_LANGUAGES) == set(SUPPORTED_LANGUAGES)
    for code in SUPPORTED_LANGUAGES:
        text = build_help_message(code)
        for cmd in ("/start", "/language", "/help"):
            assert cmd in text, f"{code} help missing {cmd}"


def test_help_translates_to_native_when_supported():
    it = build_help_message("it")
    en = build_help_message("en")
    assert it != en
    assert "Aiuto" in it or "Comandi" in it
