import os
from dotenv import load_dotenv
import redis
from datetime import timedelta

load_dotenv()

class Config:
    # Flask
    SECRET_KEY = os.environ.get("SECRET_KEY")  # fallback for dev
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URI")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    FLASK_ENV = os.environ.get("FLASK_ENV", "development")
    DEBUG = FLASK_ENV == "development"
    BUSINESS_TIMEZONE = os.environ.get("BUSINESS_TIMEZONE", "America/Chicago")
    RECEIPTS_EMAIL = os.environ.get("RECEIPTS_EMAIL", "receipts@mattsappliancesla.net")
    RECEIPT_AUTOMATION_WEBHOOK_URL = os.environ.get("RECEIPT_AUTOMATION_WEBHOOK_URL")
    RECEIPT_AUTOMATION_TOKEN = os.environ.get("RECEIPT_AUTOMATION_TOKEN")

    # Sessions
    SESSION_TYPE = "redis"
    SESSION_REDIS = redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379"))
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_PERMANENT = True
    SESSION_COOKIE_SECURE = FLASK_ENV == "production"   # only secure cookies in prod
    SESSION_COOKIE_HTTPONLY = True
    SESSION_USE_SIGNER = True
    SESSION_KEY_PREFIX = "teams:"
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)

    # CORS
    if FLASK_ENV == "production":
        CORS_ORIGINS = ["https://mattsteamportal.com"]
    else:
        CORS_ORIGINS = ["http://localhost:5173",  "http://192.168.1.205:5173",  "http://192.168.1.248:5173", "http://192.168.1.165:5173", "http://192.168.1.181:5173"]  # 0: local; 1: back shop; 2: main office; 3: home pi; 4: home laptop;
    CORS_SUPPORTS_CREDENTIALS = True
    
    # Mail
    MAIL_SERVER = "smtp.gmail.com"
    MAIL_PORT = 587
    MAIL_USERNAME = "cameron@mattsappliancesla.net"
    MAIL_PASSWORD = os.environ.get("APP_PASSWORD")
    MAIL_USE_TLS = True
    MAIL_DEFAULT_SENDER = "cameron@mattsappliancesla.net"
    
    
    # Upload folder
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024
    
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    
    

    

