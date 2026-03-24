"""
Management command to run all spiders sequentially.
Designed for Railway cron jobs — no Celery/Redis needed.
Usage: python manage.py run_scrapers [--spider linkedin] [--deactivate-expired]
"""
import os
import subprocess
import sys
import logging
from datetime import date, datetime

from django.conf import settings
from django.core.management.base import BaseCommand

logger = logging.getLogger('scraper.commands')

SPIDER_NAMES = [
    'linkedin',
    'itukariyer_linkedin',
    'youthall',
    'anbea',
    'boomerang',
    'toptalent',
    'savunma',
    'odtu_kpm',
    'bogazici_km',
    'ytu_orkam',
    'kariyer',
]


class Command(BaseCommand):
    help = 'Run all scrapers sequentially and deactivate expired listings.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--spider',
            type=str,
            help='Run only a specific spider (e.g. linkedin, youthall)',
        )
        parser.add_argument(
            '--deactivate-expired',
            action='store_true',
            default=True,
            help='Deactivate listings with past deadlines (default: True)',
        )
        parser.add_argument(
            '--no-deactivate',
            action='store_true',
            help='Skip deactivating expired listings',
        )

    def handle(self, *args, **options):
        started = datetime.utcnow()
        self.stdout.write(self.style.SUCCESS(
            f'[{started.strftime("%Y-%m-%d %H:%M:%S")}] Scraper run started'
        ))

        spiders = [options['spider']] if options['spider'] else SPIDER_NAMES
        results = {}

        for spider_name in spiders:
            result = self._run_spider(spider_name)
            results[spider_name] = result

        # Deactivate expired listings
        if not options.get('no_deactivate'):
            self._deactivate_expired()

        # Summary
        ok_count = sum(1 for r in results.values() if r == 'ok')
        fail_count = sum(1 for r in results.values() if r == 'error')
        finished = datetime.utcnow()
        duration = (finished - started).total_seconds()

        self.stdout.write(self.style.SUCCESS(
            f'\n[{finished.strftime("%Y-%m-%d %H:%M:%S")}] Scraper run finished '
            f'in {duration:.0f}s — {ok_count} ok, {fail_count} failed'
        ))

        for name, status in results.items():
            style = self.style.SUCCESS if status == 'ok' else self.style.ERROR
            self.stdout.write(style(f'  {name}: {status}'))

    def _run_spider(self, spider_name: str) -> str:
        self.stdout.write(f'  Running {spider_name}...')
        try:
            env = os.environ.copy()
            env['SCRAPY_SETTINGS_MODULE'] = 'apps.scraper.settings'
            env['PYTHONPATH'] = str(settings.BASE_DIR)

            proc = subprocess.run(
                [sys.executable, '-m', 'scrapy', 'crawl', spider_name],
                capture_output=True,
                text=True,
                timeout=600,
                cwd=settings.BASE_DIR,
                env=env,
            )

            if proc.returncode != 0:
                logger.error(f'SPIDER_FAILED [{spider_name}]: {proc.stderr[-500:]}')
                self.stdout.write(self.style.ERROR(
                    f'  ✗ {spider_name} failed: {proc.stderr[-200:]}'
                ))
                return 'error'

            self.stdout.write(self.style.SUCCESS(f'  ✓ {spider_name} completed'))
            return 'ok'

        except subprocess.TimeoutExpired:
            logger.error(f'SPIDER_TIMEOUT [{spider_name}]')
            self.stdout.write(self.style.ERROR(f'  ✗ {spider_name} timed out'))
            return 'error'
        except Exception as exc:
            logger.error(f'SPIDER_ERROR [{spider_name}]: {exc}')
            self.stdout.write(self.style.ERROR(f'  ✗ {spider_name} error: {exc}'))
            return 'error'

    def _deactivate_expired(self):
        from apps.listings.models import Listing

        today = date.today()
        count = Listing.objects.filter(
            application_deadline__lt=today,
            is_active=True,
        ).update(is_active=False, deadline_status='expired')

        self.stdout.write(self.style.SUCCESS(
            f'  Deactivated {count} expired listings'
        ))
