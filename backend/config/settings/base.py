# ════════════════════════════════════════════════════════════════════
# config/settings/base.py
# ════════════════════════════════════════════════════════════════════
from pathlib import Path
import os
from apps.scraper.beat_schedule import build_celery_beat_schedule

try:
    from celery.schedules import crontab
except ImportError:
    crontab = None

BASE_DIR = Path(__file__).resolve().parent.parent.parent
USE_SQLITE = os.environ.get('USE_SQLITE', 'False').lower() == 'true'


def _resolve_environment() -> str:
    explicit_environment = os.environ.get('APP_ENV') or os.environ.get('ENVIRONMENT')
    if explicit_environment:
        return explicit_environment.lower()

    settings_module = os.environ.get('DJANGO_SETTINGS_MODULE', '')
    if settings_module.endswith('.prod'):
        return 'prod'
    if settings_module.endswith('.dev'):
        return 'dev'
    return 'dev' if os.environ.get('DEBUG', 'False').lower() == 'true' else 'prod'

SECRET_KEY = os.environ.get('SECRET_KEY', 'change-me-in-production')
DEBUG      = False
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost').split(',')
ENVIRONMENT = _resolve_environment()

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'django_celery_beat',
    # Local
    'apps.listings',
    'apps.scraper',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF    = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
AUTH_USER_MODEL  = 'listings.Student'
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

if USE_SQLITE:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME':     os.environ.get('DB_NAME') or os.environ.get('PGDATABASE', 'iuc_staj_db'),
            'USER':     os.environ.get('DB_USER') or os.environ.get('PGUSER', 'postgres'),
            'PASSWORD': os.environ.get('DB_PASSWORD') or os.environ.get('PGPASSWORD', 'password'),
            'HOST':     os.environ.get('DB_HOST') or os.environ.get('PGHOST', 'localhost'),
            'PORT':     os.environ.get('DB_PORT') or os.environ.get('PGPORT', '5432'),
        }
    }

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/day',
        'user': '1000/day',
        'review': '5/minute',  # Anti-spam for reviews and bookmarks
    }
}

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(hours=2),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS':  True,
}

CELERY_BROKER_URL        = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND    = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
CELERY_TIMEZONE          = 'Europe/Istanbul'
CELERY_BEAT_SCHEDULER    = 'django_celery_beat.schedulers:DatabaseScheduler'
CELERY_BEAT_SCHEDULE      = build_celery_beat_schedule(crontab)

if USE_SQLITE:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'iuc-staj-dev',
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': os.environ.get('REDIS_URL', 'redis://localhost:6379/1'),
        }
    }

CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS', 'http://localhost:3000'
).split(',')

EMAIL_BACKEND       = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST          = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT          = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS       = True
EMAIL_HOST_USER     = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL  = os.environ.get('DEFAULT_FROM_EMAIL') or EMAIL_HOST_USER or 'noreply@iuc-staj.com'
FRONTEND_URL        = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

STATIC_URL  = '/static/'
MEDIA_URL   = '/media/'
MEDIA_ROOT  = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
LANGUAGE_CODE = 'tr-tr'
TIME_ZONE     = 'Europe/Istanbul'
USE_TZ        = True

# ── CV / Dosya Depolama ──────────────────────────────────────────────
# 'local'  → MEDIA_ROOT'a yaz (geliştirme ortamı)
# 'r2'     → Cloudflare R2'ye yükle (production)
CV_STORAGE_BACKEND   = os.environ.get('CV_STORAGE_BACKEND', 'local')
R2_ACCOUNT_ID        = os.environ.get('R2_ACCOUNT_ID', '')
R2_ACCESS_KEY_ID     = os.environ.get('R2_ACCESS_KEY_ID', '')
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY', '')
R2_BUCKET_NAME       = os.environ.get('R2_BUCKET_NAME', 'iuc-staj-cvs')
R2_PUBLIC_URL        = os.environ.get('R2_PUBLIC_URL', '')  # https://pub-xxx.r2.dev
