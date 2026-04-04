import logging
import os
from pathlib import Path
from celery import shared_task
from django.conf import settings
from dotenv import load_dotenv

load_dotenv(Path(settings.BASE_DIR) / '.env')

logger = logging.getLogger('scraper.tasks')

SPIDER_MAP = {
    'linkedin':  'apps.scraper.spiders.spiders.LinkedInSpider',
    'itukariyer_linkedin': 'apps.scraper.spiders.spiders.ItuKariyerLinkedinSpider',
    'youthall':  'apps.scraper.spiders.spiders.YouthallSpider',
    'anbea':     'apps.scraper.spiders.spiders.AnbeaSpider',
    'boomerang': 'apps.scraper.spiders.spiders.BoomerangSpider',
    'toptalent': 'apps.scraper.spiders.spiders.TopTalentSpider',
    'savunma':   'apps.scraper.spiders.spiders.SavunmaSpider',
    'odtu_kpm':  'apps.scraper.spiders.spiders.OdtuKpmSpider',
    'bogazici_km': 'apps.scraper.spiders.spiders.BogaziciKariyerSpider',
    'ytu_orkam': 'apps.scraper.spiders.spiders.YtuOrkamSpider',
    'kariyer':   'apps.scraper.spiders.spiders.KariyerSpider',
}


# ─── Tasks ────────────────────────────────────────────────────────────────────

@shared_task(name='apps.scraper.tasks.run_all_scrapers')
def run_all_scrapers():
    """Trigger all spiders sequentially (avoids Twisted reactor conflicts)."""
    results = {}
    for name in SPIDER_MAP:
        result = run_single_spider.delay(name)
        results[name] = result.id
    logger.info(f'Dispatched {len(results)} spider tasks: {list(results.keys())}')
    return results


@shared_task(
    name='apps.scraper.tasks.run_single_spider',
    bind=True,
    max_retries=2,
    default_retry_delay=120,
)
def run_single_spider(self, spider_name: str):
    """Run a single Scrapy spider in a subprocess to avoid reactor conflicts."""
    import os
    import subprocess
    import sys
    from datetime import datetime

    spider_cls = SPIDER_MAP.get(spider_name)
    if not spider_cls:
        raise ValueError(f'Unknown spider: {spider_name}')

    module, cls = spider_cls.rsplit('.', 1)
    started_at  = datetime.utcnow()

    try:
        env = os.environ.copy()
        # Ensure Scrapy can always resolve project settings when called from Celery.
        env.setdefault('SCRAPY_SETTINGS_MODULE', 'apps.scraper.settings')
        env.setdefault('PYTHONPATH', str(settings.BASE_DIR))
        env.setdefault('USE_SQLITE', os.environ.get('USE_SQLITE', 'True'))

        proc = subprocess.run(
            [sys.executable, '-m', 'scrapy', 'crawl', spider_name],
            capture_output=True, text=True, timeout=600,
            cwd=settings.BASE_DIR,
            env=env,
        )
        finished_at = datetime.utcnow()

        if proc.returncode != 0:
            logger.error(f'SPIDER_FAILED [{spider_name}]: {proc.stderr[-500:]}')
            _log_scraper(spider_name, started_at, finished_at, error_log=proc.stderr)
            return {'spider': spider_name, 'status': 'error'}

        # Parse Scrapy stats from stdout
        stats = _parse_scrapy_stats(proc.stdout)
        _log_scraper(spider_name, started_at, finished_at, **stats)
        logger.info(f'SPIDER_OK [{spider_name}]: {stats}')
        return {'spider': spider_name, 'status': 'ok', **stats}

    except subprocess.TimeoutExpired:
        logger.error(f'SPIDER_TIMEOUT [{spider_name}]')
        raise self.retry(exc=Exception('Spider timeout'))
    except Exception as exc:
        logger.error(f'SPIDER_ERROR [{spider_name}]: {exc}')
        raise self.retry(exc=exc)


@shared_task(name='apps.scraper.tasks.deactivate_expired_listings')
def deactivate_expired_listings():
    """Set is_active=False and deadline_status='expired' for past deadlines."""
    from datetime import date
    from apps.listings.models import Listing

    today = date.today()
    count = Listing.objects.filter(
        application_deadline__lt=today,
        is_active=True,
    ).update(is_active=False, deadline_status='expired')

    logger.info(f'DEACTIVATED {count} expired listings (today={today})')
    return {'deactivated': count}


@shared_task(name='apps.scraper.tasks.mark_upcoming_programs')
def mark_upcoming_programs():
    """
    Mark known annual programs as 'upcoming' when deadline is missing.
    Prevents showing them as stale/unknown.
    """
    from apps.listings.models import Listing

    KNOWN_ANNUAL_KEYWORDS = [
        'gelecek tasarımcıları',
        'a yetenek',
        'young challengers',
        'future leaders',
        'gelecek vaat edenler',
        'genç yetenek',
    ]
    total = 0
    for kw in KNOWN_ANNUAL_KEYWORDS:
        count = Listing.objects.filter(
            title__icontains=kw,
            application_deadline__isnull=True,
            is_active=True,
        ).update(deadline_status='upcoming')
        total += count

    logger.info(f'MARKED {total} listings as upcoming')
    return {'marked_upcoming': total}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_scrapy_stats(stdout: str) -> dict:
    """Extract new/updated/skipped counts from Scrapy log output."""
    import re
    def find(pattern):
        m = re.search(pattern, stdout)
        return int(m.group(1)) if m else 0
    return {
        'new_count':     find(r'NEW: (\d+)'),
        'updated_count': find(r'REACTIVATED: (\d+)'),
        'skipped_count': find(r'SKIPPED: (\d+)'),
        'error_count':   find(r'ERROR: (\d+)'),
    }


def _log_scraper(spider_name, started_at, finished_at, new_count=0,
                 updated_count=0, skipped_count=0, error_count=0, error_log=''):
    from apps.listings.models import ScraperLog
    ScraperLog.objects.create(
        spider_name=spider_name,
        started_at=started_at,
        finished_at=finished_at,
        new_count=new_count,
        updated_count=updated_count,
        skipped_count=skipped_count,
        error_count=error_count,
        error_log=error_log[:5000],
    )


# ─── Weekly Digest ────────────────────────────────────────────────────────────

@shared_task(name='apps.scraper.tasks.send_weekly_digest')
def send_weekly_digest():
    """Send a weekly email digest to users who opted in, based on their sector/location preferences."""
    from datetime import date, timedelta
    from django.conf import settings
    from django.core.mail import send_mail
    from django.db.models import Q
    from apps.listings.models import EM_FOCUS_CHOICES, Listing, Student

    focus_labels = dict(EM_FOCUS_CHOICES)
    one_week_ago = date.today() - timedelta(days=7)
    sent = 0
    skipped = 0

    students = Student.objects.filter(
        is_verified=True,
        notification_preferences__enabled=True,
    )

    for student in students.iterator():
        prefs = student.notification_preferences or {}
        sectors = prefs.get('sectors', [])
        locations = prefs.get('locations', [])

        if not sectors and not locations:
            skipped += 1
            continue

        q = Q(is_active=True, created_at__date__gte=one_week_ago)
        q &= ~Q(deadline_status='expired')

        match_q = Q()
        if sectors:
            match_q |= Q(em_focus_area__in=sectors) | Q(secondary_em_focus_area__in=sectors)
        if locations:
            loc_q = Q()
            for loc in locations:
                loc_q |= Q(location__icontains=loc.strip())
            match_q |= loc_q

        listings = list(
            Listing.objects.filter(q & match_q)
            .order_by('-created_at')[:20]
        )

        if not listings:
            skipped += 1
            continue

        # Build email body
        lines = [
            f'Merhaba {student.first_name or "Öğrenci"},\n',
            f'Son 7 günde tercihlerine uyan {len(listings)} yeni ilan bulundu:\n',
        ]
        for i, l in enumerate(listings, 1):
            area = focus_labels.get(l.em_focus_area, l.em_focus_area)
            lines.append(
                f'{i}. {l.title} — {l.company_name}\n'
                f'   📍 {l.location} | 🏷️ {area}\n'
                f'   {settings.FRONTEND_URL}/listings/{l.id}\n'
            )
        lines.append(
            f'\nTüm ilanları görüntüle: {settings.FRONTEND_URL}/listings\n'
            f'Bildirim ayarlarını değiştirmek için: {settings.FRONTEND_URL}/dashboard\n'
        )

        try:
            send_mail(
                subject=f'IUC Staj — Haftalık Özet ({len(listings)} yeni ilan)',
                message='\n'.join(lines),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[student.iuc_email],
                fail_silently=True,
            )
            sent += 1
        except Exception as exc:
            logger.error(f'DIGEST_EMAIL_FAIL [{student.iuc_email}]: {exc}')

    logger.info(f'WEEKLY_DIGEST sent={sent} skipped={skipped}')
    return {'sent': sent, 'skipped': skipped}
