#!/bin/sh
set -e

export DJANGO_SETTINGS_MODULE=config.settings.prod

python manage.py migrate
python manage.py ensure_admin
python manage.py reset_password
python manage.py verify_students
python manage.py import_production_listings

if [ "${RUN_DEMO_SEED:-false}" = "true" ]; then
  python manage.py seed_demo_listings
fi

exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:${PORT:-8000} \
  --workers ${GUNICORN_WORKERS:-3} \
  --timeout 120 \
  --access-logfile -
