from django.core.management.base import BaseCommand

from apps.listings.eligibility_audit import audit_listing_eligibility


class Command(BaseCommand):
    help = "Audit listing student eligibility and deactivate graduate-only postings."

    def handle(self, *args, **options):
        summary = audit_listing_eligibility()
        self.stdout.write(
            self.style.SUCCESS(
                "Eligibility audit finished: "
                f"processed={summary.get('processed', 0)} "
                f"updated={summary.get('updated', 0)} "
                f"deactivated={summary.get('deactivated', 0)} "
                f"graduate_only={summary.get('graduate_only', 0)} "
                f"requires_experience={summary.get('requires_experience', 0)}"
            )
        )
