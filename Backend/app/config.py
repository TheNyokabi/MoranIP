import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    API_ENV: str = "production"
    SECRET_KEY: str = "secret"
    
    # Database
    POSTGRES_USER: str = "odoo"
    POSTGRES_DB: str = "postgres"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    # Password can be loaded from env var OR secret file
    POSTGRES_PASSWORD: str = ""

    # Odoo
    ODOO_DB_HOST: str = "odoo"
    ODOO_DB_PORT: int = 8069

    # Kafka
    # Kafka
    KAFKA_BROKER: str = "kafka:9092"

    # ERPNext
    ERPNEXT_HOST: str = "http://erpnext:8000"
    ERPNEXT_USER: str = "Administrator"
    ERPNEXT_PASSWORD: str = "admin"
    ERPNEXT_SITE: str = "moran.localhost"
    ERPNEXT_API_KEY: str = "admin"
    ERPNEXT_API_SECRET: str = "12345678"
    
    # M-Pesa (Optional - for POS payments)
    MPESA_CONSUMER_KEY: str = ""
    MPESA_CONSUMER_SECRET: str = ""
    MPESA_PASSKEY: str = ""
    MPESA_SHORTCODE: str = ""
    MPESA_ENVIRONMENT: str = "sandbox"  # sandbox or production
    
    # Redis (Optional - for caching)
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # API Base URL (for webhooks and callbacks)
    API_BASE_URL: str = "http://localhost:9000"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Load secrets if not set in env
        if not self.POSTGRES_PASSWORD:
            self.POSTGRES_PASSWORD = self._read_secret("postgres_password")

    def _read_secret(self, secret_name: str) -> str:
        try:
            with open(f"/run/secrets/{secret_name}", "r") as f:
                return f.read().strip()
        except FileNotFoundError:
            return ""

settings = Settings()
