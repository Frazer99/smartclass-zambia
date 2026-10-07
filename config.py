import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "SmartClass Zambia API"
    environment: str = os.getenv("ENVIRONMENT", "development")
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
    mtn_momo_api_user: str = os.getenv("MTN_MOMO_API_USER", "")
    mtn_momo_api_key: str = os.getenv("MTN_MOMO_API_KEY", "")
    mtn_momo_subscription_key: str = os.getenv("MTN_MOMO_SUBSCRIPTION_KEY", "")
    mtn_momo_target_env: str = os.getenv("MTN_MOMO_TARGET_ENV", "sandbox")
    mtn_momo_base_url: str = os.getenv("MTN_MOMO_BASE_URL", "https://sandbox.momodeveloper.mtn.com")
    airtel_money_api_key: str = os.getenv("AIRTEL_MONEY_API_KEY", "")
    airtel_base_url: str = os.getenv("AIRTEL_BASE_URL", "")
    airtel_access_token: str = os.getenv("AIRTEL_ACCESS_TOKEN", "")
    dpo_company_token: str = os.getenv("DPO_COMPANY_TOKEN", "")  # Visa/card processor for Zambia
    dpo_service_type: str = os.getenv("DPO_SERVICE_TYPE", "")
    dpo_base_url: str = os.getenv("DPO_BASE_URL", "https://secure.3gdirectpay.com/API/v6/")
    dpo_checkout_url: str = os.getenv("DPO_CHECKOUT_URL", "https://secure.3gdirectpay.com/payv3.php")
    site_url: str = os.getenv("SITE_URL", "http://localhost:3000")

    cors_origins: list[str] = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]

    class Config:
        env_file = ".env"


settings = Settings()
if settings.environment == "production":
    if settings.secret_key == "dev-secret-change-me-in-production":
        raise ValueError("SECRET_KEY must be set to a unique value in production")
    if "*" in settings.cors_origins:
        raise ValueError("CORS_ORIGINS must list trusted production origins explicitly")
    if not settings.site_url.startswith("https://"):
        raise ValueError("SITE_URL must use HTTPS in production")
os.makedirs(settings.upload_dir, exist_ok=True)
