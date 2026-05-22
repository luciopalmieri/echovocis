import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.providers.stt_xai import XaiSTT
from src.providers.tts_xai import XaiTTS


async def test_xai_stt_transcribe():
    stt = XaiSTT(api_key="test-key")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"text": "Hello world"}
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await stt.transcribe(b"fake-audio", language="en")
        assert result == "Hello world"


async def test_xai_tts_synthesize():
    tts = XaiTTS(api_key="test-key")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"fake-audio-bytes"
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        result = await tts.synthesize("Hello", voice="ara", language="en")
        assert result == b"fake-audio-bytes"
