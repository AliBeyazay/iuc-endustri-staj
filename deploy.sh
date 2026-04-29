#!/bin/bash
# VPS'te ilk kurulum ve güncelleme için deploy scripti
# Kullanım: ./deploy.sh [--first-run]
set -e

COMPOSE="docker compose -f docker-compose.prod.yml"

if [ "$1" == "--first-run" ]; then
    echo "=== İlk kurulum başlıyor ==="

    # .env.prod oluşturulmuş mu kontrol et
    if [ ! -f .env.prod ]; then
        cp .env.prod.example .env.prod
        echo "HATA: .env.prod oluşturuldu — içindeki değerleri doldur, sonra tekrar çalıştır."
        exit 1
    fi

    # SSL sertifikası için nginx dizinini oluştur
    mkdir -p nginx/certs

    # Servisleri başlat (nginx olmadan önce)
    $COMPOSE up -d db redis
    sleep 5

    $COMPOSE up -d backend
    echo "Migration bekleniyor..."
    sleep 15

    # Süper kullanıcı oluştur
    $COMPOSE exec backend python manage.py createsuperuser

    $COMPOSE up -d

    echo ""
    echo "=== Kurulum tamamlandı ==="
    echo "SSL sertifikası için: sudo certbot certonly --webroot -w nginx/certs -d yourdomain.com"
    echo "Sertifikaları nginx/certs/ dizinine kopyala: fullchain.pem, privkey.pem"
    exit 0
fi

echo "=== Deploy başlıyor ==="

# Son değişiklikleri çek
git pull origin main

# Image'ları yeniden build et
$COMPOSE build --no-cache backend celery celery-beat frontend

# Servisleri güncelle (sıfır downtime değil ama yeterli)
$COMPOSE up -d --remove-orphans

# Migration
echo "Migration çalışıyor..."
$COMPOSE exec -T backend python manage.py migrate --noinput

# Static dosyalar
$COMPOSE exec -T backend python manage.py collectstatic --noinput --clear

# Eski image'ları temizle
docker image prune -f

echo "=== Deploy tamamlandı ==="
$COMPOSE ps
