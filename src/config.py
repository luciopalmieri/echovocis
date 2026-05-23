from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    llm_provider: str = "openai"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    stt_provider: str = "xai"
    xai_api_key: str = ""

    tts_provider: str = "xai"
    tts_voice: str = "ara"

    telegram_bot_token: str = ""

    database_url: str = "postgresql+asyncpg://echovocis:password@localhost:5432/echovocis"

    app_env: str = "development"
    log_level: str = "INFO"
    session_timeout_minutes: int = 10


settings = Settings()
