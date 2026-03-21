import json
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.listings.models import Listing


class Command(BaseCommand):
    help = "Import real listings from a JSON export into the current database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            default="apps/listings/fixtures/production_real_listings.json",
            help="Path to the JSON file exported from the local SQLite database.",
        )

    def handle(self, *args, **options):
        source_path = Path(options["path"])
        if not source_path.exists():
            raise CommandError(f"Import file not found: {source_path}")

        try:
            records = json.loads(source_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON in import file: {exc}") from exc

        created = 0
        updated = 0

        for payload in records:
            source_url = (payload.get("source_url") or "").strip()
            if not source_url:
                continue

            defaults = {
                "title": payload.get("title", ""),
                "company_name": payload.get("company_name", ""),
                "company_logo_url": payload.get("company_logo_url") or None,
                "application_url": payload.get("application_url") or None,
                "source_platform": payload.get("source_platform", "linkedin"),
                "em_focus_area": payload.get("em_focus_area") or "diger",
                "secondary_em_focus_area": payload.get("secondary_em_focus_area") or None,
                "em_focus_confidence": self.parse_decimal(payload.get("em_focus_confidence")),
                "internship_type": payload.get("internship_type") or "belirsiz",
                "company_origin": payload.get("company_origin") or "belirsiz",
                "location": payload.get("location", ""),
                "description": payload.get("description", ""),
                "requirements": payload.get("requirements", ""),
                "application_deadline": payload.get("application_deadline") or None,
                "deadline_status": payload.get("deadline_status") or "unknown",
                "is_active": bool(payload.get("is_active", True)),
                "is_talent_program": bool(payload.get("is_talent_program", False)),
                "program_type": payload.get("program_type") or None,
                "duration_weeks": payload.get("duration_weeks") or None,
            }

            _, was_created = Listing.objects.update_or_create(
                source_url=source_url,
                defaults=defaults,
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Production listings imported. created={created} updated={updated} total={Listing.objects.count()}"
            )
        )

    def parse_decimal(self, value):
        if value in (None, ""):
            return Decimal("0")
        return Decimal(str(value))
