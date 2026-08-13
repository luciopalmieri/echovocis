from telegram.error import TimedOut

from src.telegram_bot.handlers import _fetch_voice_bytes


class _FakeFile:
    def __init__(self, data=None, raises=False):
        self._data = data
        self._raises = raises

    async def download_as_bytearray(self):
        if self._raises:
            raise TimedOut()
        return self._data


class _FakeVoice:
    def __init__(self, outcomes):
        self._outcomes = list(outcomes)
        self._n = 0

    async def get_file(self):
        outcome = self._outcomes[self._n]
        self._n += 1
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome


async def test_fetch_voice_success_first_try():
    voice = _FakeVoice([_FakeFile(bytearray(b"audio"))])
    result = await _fetch_voice_bytes(voice)
    assert result == b"audio"


async def test_fetch_voice_retries_then_succeeds():
    voice = _FakeVoice([TimedOut(), _FakeFile(bytearray(b"audio"))])
    result = await _fetch_voice_bytes(voice)
    assert result == b"audio"


async def test_fetch_voice_returns_none_after_two_timeouts():
    voice = _FakeVoice([TimedOut(), TimedOut()])
    result = await _fetch_voice_bytes(voice)
    assert result is None
