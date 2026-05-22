import os
from unittest.mock import patch

from src.config import Settings


def test_defaults():
    with patch.dict(os.environ, {"TELEGRAM_BOT_TOKEN": "fake", "OPENAI_API_KEY": "fake", "XAI_API_KEY": "fake"}, clear=True):
        s = Settings()
        assert s.llm_provider == "openai"
        assert s.openai_model == "gpt-4o"
        assert s.stt_provider == "xai"
        assert s.tts_voice == "ara"
        assert s.session_timeout_minutes == 10
