from abc import ABC, abstractmethod


class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_data: bytes, language: str | None = None) -> str:
        ...


class TTSProvider(ABC):
    @abstractmethod
    async def synthesize(self, text: str, voice: str = "ara", language: str = "en") -> bytes:
        ...
