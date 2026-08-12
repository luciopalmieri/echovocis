from src.telegram_bot.onboarding import (
    OnboardingDeps,
    Responder,
    handle_lang_action,
    synthesize_voice_or_none,
)


class _FakeTTS:
    def __init__(self, audio: bytes | None = b"audio", raises: bool = False):
        self._audio = audio
        self._raises = raises
        self.calls = []

    async def synthesize(self, text, voice="ara", language="en"):
        self.calls.append({"text": text, "voice": voice, "language": language})
        if self._raises:
            raise RuntimeError("unsupported language")
        return self._audio


class _FakeResponder(Responder):
    def __init__(self):
        self.events: list[tuple] = []

    async def text(self, text, reply_markup=None):
        self.events.append(("text", text, reply_markup))

    async def voice(self, audio, caption=None, reply_markup=None):
        self.events.append(("voice", audio, caption, reply_markup))

    async def edit(self, text, reply_markup=None):
        self.events.append(("edit", text, reply_markup))


async def _greeter(target: str) -> str:
    return f"hello in {target}"


async def _persist(native, target):
    _persist.calls.append((native, target))


_persist.calls = []


def _deps(responder, tts):
    return OnboardingDeps(
        responder=responder,
        tts=tts,
        tts_voice="ara",
        greeter=_greeter,
        persist=_persist,
    )


async def test_synthesize_voice_returns_audio_on_success():
    tts = _FakeTTS(audio=b"mp3")
    result = await synthesize_voice_or_none(tts, "ciao", voice="ara", language="it")
    assert result == b"mp3"
    assert tts.calls == [{"text": "ciao", "voice": "ara", "language": "it"}]


async def test_synthesize_voice_returns_none_on_failure():
    tts = _FakeTTS(raises=True)
    result = await synthesize_voice_or_none(tts, "ciao", voice="ara", language="zh")
    assert result is None
    assert tts.calls == [{"text": "ciao", "voice": "ara", "language": "zh"}]


async def test_native_action_edits_message_with_target_picker_excluding_native():
    r = _FakeResponder()
    await handle_lang_action("native", "it", None, deps=_deps(r, _FakeTTS()))
    assert r.events[0][0] == "edit"
    markup = r.events[0][2]
    codes = [b["callback_data"].split(":")[2] for row in markup.to_dict()["inline_keyboard"] for b in row]
    assert "it" not in codes


async def test_target_action_sends_voice_preview_with_confirm_keyboard():
    r = _FakeResponder()
    await handle_lang_action("target", "it", "en", deps=_deps(r, _FakeTTS(audio=b"wav")))
    assert r.events[0] == ("voice", b"wav", "hello in en", r.events[0][3])
    markup = r.events[0][3]
    datas = {b["callback_data"] for row in markup.to_dict()["inline_keyboard"] for b in row}
    assert "lang_confirm:it:en" in datas


async def test_target_action_falls_back_when_tts_fails():
    r = _FakeResponder()
    await handle_lang_action("target", "it", "zh", deps=_deps(r, _FakeTTS(raises=True)))
    # No voice sent, only the fallback text + target picker
    assert all(e[0] != "voice" for e in r.events)
    assert any("non disponibile" in e[1] for e in r.events if e[0] == "text")
    markup = next(e[2] for e in r.events if e[0] == "text")
    codes = [b["callback_data"].split(":")[2] for row in markup.to_dict()["inline_keyboard"] for b in row]
    assert "zh" in codes and "it" not in codes


async def test_confirm_action_persists_and_welcomes():
    r = _FakeResponder()
    _persist.calls = []
    await handle_lang_action("confirm", "it", "en", deps=_deps(r, _FakeTTS()))
    assert _persist.calls == [("it", "en")]
    assert any("Tutto pronto" in e[1] for e in r.events if e[0] == "text")

