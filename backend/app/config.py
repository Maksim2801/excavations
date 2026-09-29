from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://archaeology:archaeology@localhost:5432/archaeology_db"
    jwt_secret: str = "change-me-in-local-env"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720
    upload_dir: str = "uploads"
    report_dir: str = "reports"
    frontend_dir: str = "../frontend"
    max_upload_mb: int = 20
    base_url: str = "http://localhost:8000"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
