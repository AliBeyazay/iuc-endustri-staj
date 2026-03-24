from .base import *
import os

DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', 'backend', 'frontend', '.ngrok-free.dev', '.ngrok.io']

# In development, use real SMTP when credentials are configured.
email_user = os.environ.get('EMAIL_HOST_USER', '').strip()
email_password = os.environ.get('EMAIL_HOST_PASSWORD', '').strip()
placeholder_values = {'', 'your@gmail.com', 'your-app-password'}

if email_user in placeholder_values or email_password in placeholder_values:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
else:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

# Dev: allow all CORS origins
CORS_ALLOW_ALL_ORIGINS = True
