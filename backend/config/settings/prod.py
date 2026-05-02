from .base import *
import os
import dj_database_url
from django.core.exceptions import ImproperlyConfigured

DEBUG = False

# Raise immediately if the secret key is the insecure placeholder or missing.
_secret_key = os.environ.get('SECRET_KEY', '')
if not _secret_key or _secret_key == 'change-me-in-production':
    raise ImproperlyConfigured('SECRET_KEY env var must be set in production.')
SECRET_KEY = _secret_key

# Never fall back to * — an unset ALLOWED_HOSTS is a misconfigured deployment.
ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get('ALLOWED_HOSTS', '.onrender.com').split(',')
    if h.strip()
]

# Railway provides DATABASE_URL; fall back to individual DB_* vars from base.py
_database_url = os.environ.get('DATABASE_URL')
if _database_url:
    DATABASES = {
        'default': dj_database_url.parse(_database_url, conn_max_age=600),
    }

MIDDLEWARE = ['config.healthcheck.HealthcheckMiddleware', 'django.middleware.security.SecurityMiddleware', 'whitenoise.middleware.WhiteNoiseMiddleware', *[m for m in MIDDLEWARE if m not in ('config.healthcheck.HealthcheckMiddleware', 'django.middleware.security.SecurityMiddleware')]]

# CORS — allow Vercel frontend.
# Strip and drop empty strings so a trailing comma in the env var never
# produces an empty origin that django-cors-headers rejects loudly.
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        'CORS_ALLOWED_ORIGINS',
        'https://iuc-endustri-staj.vercel.app,http://localhost:3000',
    ).split(',')
    if o.strip()
]
CORS_ALLOW_CREDENTIALS = True

# Security
SECURE_PROXY_SSL_HEADER    = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST       = True
SECURE_SSL_REDIRECT         = os.environ.get('SECURE_SSL_REDIRECT', 'True').lower() == 'true'
SESSION_COOKIE_SECURE       = True
CSRF_COOKIE_SECURE          = True
SECURE_BROWSER_XSS_FILTER   = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS             = 'DENY'
SECURE_HSTS_SECONDS         = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD         = True

# CSRF — trust the Vercel frontend and Railway/Render backend domains.
# Override via CSRF_TRUSTED_ORIGINS env var (comma-separated) if needed.
_csrf_default = ','.join([
    'https://iuc-endustri-staj.vercel.app',
    'https://*.railway.app',
    'https://*.onrender.com',
])
_csrf_origins = os.environ.get('CSRF_TRUSTED_ORIGINS', _csrf_default)
CSRF_TRUSTED_ORIGINS = [o.strip() for o in _csrf_origins.split(',') if o.strip()]

# Fail fast if R2 is the configured storage backend but credentials are missing.
if os.environ.get('CV_STORAGE_BACKEND') == 'r2':
    _missing_r2 = [
        k for k in ('R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL')
        if not os.environ.get(k)
    ]
    if _missing_r2:
        raise ImproperlyConfigured(f'R2 storage selected but missing env vars: {", ".join(_missing_r2)}')

# Static files via WhiteNoise
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
}

_sentry_dsn = os.environ.get('SENTRY_DSN')
if _sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.redis import RedisIntegration
    sentry_sdk.init(
        dsn=_sentry_dsn,
        integrations=[DjangoIntegration(), CeleryIntegration(), RedisIntegration()],
        traces_sample_rate=float(os.environ.get('SENTRY_TRACES_SAMPLE_RATE', '0.1')),
        send_default_pii=False,
        environment='production',
    )
