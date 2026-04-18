import json

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://ts_user:password@localhost:5432/timescheduler"
    secret_key: str = "change-me-in-production"
    user_login: str = "Wor7hless"
    user_password: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 43200  # 30 days — single-user app, no refresh flow

    backup_interval_hours: int = 24
    backup_dir: str = "./backups"

    # Set CLEAN_DB_ON_STARTUP=true to truncate all data and create fresh admin (one-time reset)
    clean_db_on_startup: bool = False

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    telegram_bot_token: str = ""
    user_timezone: str = "Europe/Moscow"

    # ── LLM: переключатель провайдера ──────────────────────────────────────
    # LLM_PROVIDER=gigachat → cloud.ru (foundation-models) с GigaChat3
    # LLM_PROVIDER=nvidia   → NVIDIA NIM (integrate.api.nvidia.com)
    llm_provider: str = "gigachat"

    # GigaChat (cloud.ru)
    gigachat_api_key: str = ""  # API ключ из cloud.ru (foundation-models)
    gigachat_model: str = "ai-sage/GigaChat3-10B-A1.8B"

    # NVIDIA NIM (build.nvidia.com)
    nvidia_api_key: str = ""
    nvidia_model: str = "meta/llama-3.3-70b-instruct"

    # ntfy.sh push-уведомления
    # Тема: произвольная строка, например "timescheduler-roman-7x3k"
    # Подпишись на неё в приложении ntfy на телефоне
    ntfy_topic: str = ""          # если пусто — пуши отключены
    ntfy_server: str = "https://ntfy.sh"  # или адрес своего сервера

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors(cls, v):
        # pydantic-settings передаёт значение из .env как строку —
        # принимаем JSON-массив или CSV.
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return []
            if v.startswith("["):
                return json.loads(v)
            return [x.strip() for x in v.split(",") if x.strip()]
        return v

    @field_validator("llm_provider", mode="before")
    @classmethod
    def _normalize_llm_provider(cls, v):
        s = str(v or "gigachat").strip().lower()
        if s not in {"gigachat", "nvidia"}:
            raise ValueError(
                f"LLM_PROVIDER должен быть 'gigachat' или 'nvidia', получено: {v!r}"
            )
        return s

    model_config = {"env_file": "../.env", "env_file_encoding": "utf-8"}


settings = Settings()
