# Docker Scraper Flow

Playwright tabanli scraper'lar Windows Python yerine Docker icindeki Linux ortaminda calistirilmalidir.

## Build

```bash
docker compose build celery celery-beat
```

## Run One Spider

```bash
docker compose --profile scraper run --rm scraper crawl linkedin
docker compose --profile scraper run --rm scraper crawl youthall
```

Windows icin yardimci betik:

```bat
backend\run_scraper_docker.bat youthall
```

## Run All Spiders

```bash
docker compose exec backend python manage.py shell -c "
from apps.scraper.tasks import run_all_scrapers
run_all_scrapers.delay()
"
```

## Sync Celery Beat

Koddan yonetilen Beat kayitlarini hizalamak icin:

```bash
docker compose exec backend python manage.py sync_celery_beat
docker compose restart celery-beat
```

## Notes

- `celery` ve `celery-beat` servisleri `backend/Dockerfile.scraper` uzerinden Linux + Playwright image'i ile build edilir.
- Gercek scrape isi Docker icindeki `scraper` veya `celery` servisi tarafinda kosmalidir.
- Windows tarafindaki Python ortaminda Playwright subprocess sorunlari gorulebildigi icin scraper'lar orada guvenilir degildir.
- Aktif toplu scrape plani `all-scrape` -> `apps.scraper.tasks.run_all_scrapers` -> `02:00 Europe/Istanbul` seklindedir.
