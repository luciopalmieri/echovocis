import httpx

from src.providers.base import TTSProvider


class XaiTTS(TTSProvider):
    def __init__(self, api_key: str):
        self._api_key = api_key
        self._url = "https://api.x.ai/v1/tts"

    async def synthesize(self, text: str, voice: str = "ara", language: str = "en") -> bytes:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self._url,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "text": text,
                    "voice_id": voice,
                    "language": language,
                },
            )
            response.raise_for_status()
            return response.content
