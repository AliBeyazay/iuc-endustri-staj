#!/bin/sh
set -e

export DJANGO_SETTINGS_MODULE=config.settings.prod

python manage.py migrate
python manage.py ensure_admin

# One-shot account bootstrap — set BOOTSTRAP_ACCOUNTS=true once, then unset.
# Never leave this enabled: anyone who can trigger a deploy can reset all passwords.
if [ "${BOOTSTRAP_ACCOUNTS:-false}" = "true" ]; then
  python manage.py reset_password
  python manage.py verify_students
  echo "Bootstrap: passwords reset and students verified."
fi

# Bootstrap from fixture only when the DB is empty (fresh deployment).
# Subsequent deploys skip this so Celery Beat's live writes are never overwritten.
LISTING_COUNT=$(python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings.prod')
django.setup()
from apps.listings.models import Listing
print(Listing.objects.count())
" 2>/dev/null || echo "0")
if [ "$LISTING_COUNT" = "0" ]; then
  python manage.py import_production_listings || echo "Warning: bootstrap import failed"
  echo "DB bootstrapped from fixture"
else
  echo "DB has ${LISTING_COUNT} listings — skipping fixture import"
fi

if [ "${RUN_DEMO_SEED:-false}" = "true" ]; then
  python manage.py seed_demo_listings
fi

exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:${PORT:-8000} \
  --workers ${GUNICORN_WORKERS:-3} \
  --timeout 120 \
  --access-logfile -
