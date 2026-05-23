import asyncio

import httpx

from src.providers.base import STTProvider


class XaiSTT(STTProvider):
    def __init__(self, api_key: str):
        self._api_key = api_key
        self._url = "https://api.x.ai/v1/stt"

    async def transcribe(self, audio_data: bytes, language: str | None = None) -> str:
        return await asyncio.to_thread(self._transcribe_sync, audio_data, language)

    def _transcribe_sync(self, audio_data: bytes, language: str | None = None) -> str:
        data = {"format": "true"}
        if language:
            data["language"] = language
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                self._url,
                headers={"Authorization": f"Bearer {self._api_key}"},
                files={"file": ("audio.ogg", audio_data, "audio/ogg")},
                data=data,
            )
            response.raise_for_status()
            return response.json()["text"]
