from .base import *
import os

DEBUG = False

ALLOWED_HOSTS = ['*']
MIDDLEWARE = ['config.healthcheck.HealthcheckMiddleware', *MIDDLEWARE]

# Security
SECURE_PROXY_SSL_HEADER    = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST       = True
SECURE_SSL_REDIRECT         = os.environ.get('SECURE_SSL_REDIRECT', 'False').lower() == 'true'
SESSION_COOKIE_SECURE       = True
CSRF_COOKIE_SECURE          = True
SECURE_BROWSER_XSS_FILTER   = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS             = 'DENY'

# Static files (use whitenoise or S3 in production)
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.ManifestStaticFilesStorage'
