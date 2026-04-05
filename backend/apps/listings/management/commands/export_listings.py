"""Export all active listings to a flat JSON file for production import."""
import json
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.listings.models import Listing

DEFAULT_PATH = "apps/listings/fixtures/production_real_listings.json"


class Command(BaseCommand):
    help = "Export listings to flat JSON (compatible with import_production_listings)."

    def add_arguments(self, parser):
        parser.add_argument("--path", default=DEFAULT_PATH)

    def handle(self, *args, **options):
        qs = Listing.objects.all().order_by("created_at")
        records = []
        for obj in qs.iterator():
            records.append(
                {
                    "title": obj.title,
                    "company_name": obj.company_name,
                    "company_logo_url": obj.company_logo_url or None,
                    "source_url": obj.source_url,
                    "application_url": obj.application_url or None,
                    "source_platform": obj.source_platform,
                    "em_focus_area": obj.em_focus_area,
                    "secondary_em_focus_area": obj.secondary_em_focus_area or None,
                    "em_focus_confidence": str(obj.em_focus_confidence),
                    "internship_type": obj.internship_type,
                    "company_origin": obj.company_origin,
                    "location": obj.location,
                    "description": obj.description,
                    "requirements": obj.requirements,
                    "application_deadline": str(obj.application_deadline) if obj.application_deadline else None,
                    "deadline_status": obj.deadline_status,
                    "is_active": obj.is_active,
                    "is_talent_program": obj.is_talent_program,
                    "program_type": obj.program_type,
                    "duration_weeks": obj.duration_weeks,
                }
            )

        out = Path(options["path"])
        out.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Exported {len(records)} listings to {out}"))
