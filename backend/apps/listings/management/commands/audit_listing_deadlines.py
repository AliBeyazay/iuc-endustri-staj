from django.core.management.base import BaseCommand

from apps.listings.deadline_audit import audit_listing_deadlines


class Command(BaseCommand):
    help = "Audit listing deadlines, recover missing dates, and expire past listings."

    def handle(self, *args, **options):
        summary = audit_listing_deadlines()
        self.stdout.write(
            self.style.SUCCESS(
                "Deadline audit finished: "
                f"processed={summary.get('processed', 0)} "
                f"updated={summary.get('updated', 0)} "
                f"expired={summary.get('deactivated_expired', 0)} "
                f"stale={summary.get('deactivated_stale', 0)} "
                f"recovered_remote={summary.get('recovered_from_application_url', 0)} "
                f"recovered_description={summary.get('recovered_from_description', 0)}"
            )
        )
