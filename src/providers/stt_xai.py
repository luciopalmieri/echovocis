import httpx

from src.providers.base import STTProvider


class XaiSTT(STTProvider):
    def __init__(self, api_key: str):
        self._api_key = api_key
        self._url = "https://api.x.ai/v1/stt"

    async def transcribe(self, audio_data: bytes, language: str | None = None) -> str:
        data = [("format", "true")]
        if language:
            data.append(("language", language))
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self._url,
                headers={"Authorization": f"Bearer {self._api_key}"},
                files={"file": ("audio.ogg", audio_data, "audio/ogg")},
                data=data,
            )
            response.raise_for_status()
            return response.json()["text"]
