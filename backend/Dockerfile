FROM python:3.12-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py collectstatic --noinput 2>/dev/null || true

EXPOSE 8000

# Prepare the database schema on startup before serving requests.
# Import real listings on startup so production always has the latest seeded dataset.
CMD ["sh", "-c", "DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py migrate && DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py ensure_admin && DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py reset_password && DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py verify_students && DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py import_production_listings && DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py audit_listing_deadlines && DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py delete_listing --title 'Ziraat Mühendisi Stajyeri' || true && DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py delete_listing --title 'Santiye Sefi' || true && DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py delete_listing --id '4cf867e0-78a5-4f5c-a440-ee8b2ae706ba' || true && DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py delete_listing --id '24d323c8-ad8c-49d9-af8b-1aec1a54f487' || true && if [ \"${RUN_DEMO_SEED:-false}\" = \"true\" ]; then DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py seed_demo_listings; fi && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}"]
