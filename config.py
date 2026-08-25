import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "SmartClass Zambia API"
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./smartclass.db")
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-change-me-in-production")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Free trial allowance, in seconds, per (user, subject)
    trial_seconds_per_subject: int = int(os.getenv("TRIAL_SECONDS_PER_SUBJECT", "600"))  # 10 minutes

    # Subscription price per subject per month, in Zambian Kwacha
    subscription_price_zmw: float = float(os.getenv("SUBSCRIPTION_PRICE_ZMW", "50"))
    subscription_period_days: int = int(os.getenv("SUBSCRIPTION_PERIOD_DAYS", "30"))

    upload_dir: str = os.getenv("UPLOAD_DIR", "./uploads")

    # Provider selection - defaults to mock so the system runs with no external keys.
    ai_provider: str = os.getenv("AI_PROVIDER", "mock")  # mock | openai
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    tts_provider: str = os.getenv("TTS_PROVIDER", "mock")  # mock | browser | elevenlabs
    avatar_provider: str = os.getenv("AVATAR_PROVIDER", "mock")  # mock | heygen

    payment_provider: str = os.getenv("PAYMENT_PROVIDER", "mock")  # mock | mtn_momo | airtel_money | dpo
    mtn_momo_api_key: str = os.getenv("MTN_MOMO_API_KEY", "")
    airtel_money_api_key: str = os.getenv("AIRTEL_MONEY_API_KEY", "")
    dpo_company_token: str = os.getenv("DPO_COMPANY_TOKEN", "")  # Visa/card processor for Zambia

    cors_origins: list[str] = ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
os.makedirs(settings.upload_dir, exist_ok=True)
