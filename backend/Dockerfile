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

# Normalize line endings so the Linux entrypoint works even if the repo was edited on Windows.
RUN sed -i 's/\r$//' /app/start-production.sh && chmod +x /app/start-production.sh

RUN DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py collectstatic --noinput 2>/dev/null || true

EXPOSE 8000

# Prepare the database schema on startup before serving requests.
# Import real listings on startup so production always has the latest seeded dataset.
CMD ["/app/start-production.sh"]
