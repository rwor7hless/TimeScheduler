from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://ts_user:password@localhost:5432/timescheduler"
    secret_key: str = "change-me-in-production"
    user_login: str = "Wor7hless"
    user_password: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    backup_interval_hours: int = 24
    backup_dir: str = "./backups"

    # Set CLEAN_DB_ON_STARTUP=true to truncate all data and create fresh admin (one-time reset)
    clean_db_on_startup: bool = False

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    telegram_bot_token: str = ""

    model_config = {"env_file": "../.env", "env_file_encoding": "utf-8"}


settings = Settings()
