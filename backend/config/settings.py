from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings, case_sensitive=True):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="allow"
    )


class AppSettings(Settings):
    model_config = SettingsConfigDict(env_prefix="APP_")

    URL: str
    API_URL: str
    JWT_SECRET: str
    JWT_ALG: str
    JWT_EXPIRE_DAYS: int


class GoogleSettings(Settings):
    model_config = SettingsConfigDict(env_prefix="GOOGLE_")

    CLIENT_ID: str
    JWT_SECRET: str
    CAPTCHA_KEY: str


class DatabaseSettings(Settings):
    model_config = SettingsConfigDict(env_prefix="DB_")

    HOST: str
    USER: str
    PASSWORD: str
    DB: str

    @property
    def db_url(self):
        return f"postgresql+asyncpg://{self.USER}:{self.PASSWORD}@{self.HOST}/{self.DB}"


app_settings = AppSettings()
google_settings = GoogleSettings()
db_settings = DatabaseSettings()
