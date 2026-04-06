from django.conf import settings
from django.core.management.base import BaseCommand

from apps.scraper.beat_schedule import sync_managed_beat_schedule


class Command(BaseCommand):
    help = 'Synchronize code-managed django-celery-beat schedules.'

    def handle(self, *args, **options):
        summary = sync_managed_beat_schedule(timezone_name=settings.CELERY_TIMEZONE)
        self.stdout.write(
            self.style.SUCCESS(
                'Synchronized Celery Beat tasks: '
                f"{summary['created']} created, "
                f"{summary['updated']} updated, "
                f"{summary['disabled']} legacy tasks disabled."
            )
        )
        self.stdout.write(
            'Managed tasks: ' + ', '.join(summary['managed_names'])
        )
