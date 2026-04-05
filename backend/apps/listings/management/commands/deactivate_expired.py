from datetime import date, timedelta

from django.core.management.base import BaseCommand

from apps.listings.models import Listing
from apps.listings.sync import update_listing_queryset


class Command(BaseCommand):
    help = "Deactivate listings with expired deadlines and stale listings (>90 days, no deadline)."

    def handle(self, *args, **options):
        today = date.today()

        expired_count = update_listing_queryset(
            Listing.objects.filter(
                application_deadline__lt=today,
                is_active=True,
            ),
            is_active=False,
            deadline_status="expired",
        )

        cutoff = today - timedelta(days=90)
        stale_count = update_listing_queryset(
            Listing.objects.filter(
                application_deadline__isnull=True,
                is_active=True,
                created_at__lt=cutoff,
            ),
            is_active=False,
            deadline_status="expired",
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Deactivated {expired_count} expired + {stale_count} stale listings (today={today})"
            )
        )
