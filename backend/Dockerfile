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

EXPOSE 8000

# Prepare the database schema on startup before serving requests.
# Optionally import real listings or seed demo data for fresh environments.
CMD ["sh", "-c", "DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py migrate && if [ \"${RUN_PRODUCTION_LISTINGS_IMPORT:-false}\" = \"true\" ]; then DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py import_production_listings; fi && if [ \"${RUN_DEMO_SEED:-false}\" = \"true\" ]; then DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py seed_demo_listings; fi && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}"]
