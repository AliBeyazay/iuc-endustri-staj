from django.core.management.base import BaseCommand

from apps.listings.deadline_audit import audit_listing_deadlines


class Command(BaseCommand):
    help = "Deactivate listings with expired deadlines and stale listings (>90 days, no deadline)."

    def handle(self, *args, **options):
        summary = audit_listing_deadlines()

        self.stdout.write(
            self.style.SUCCESS(
                "Deactivated "
                f"{summary.get('deactivated_expired', 0)} expired + "
                f"{summary.get('deactivated_stale', 0)} stale listings"
            )
        )
