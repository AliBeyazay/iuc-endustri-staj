import json
from datetime import timedelta
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.listings.management.commands.export_listings import DEFAULT_PATH
from apps.listings.management.commands.export_public_listing_snapshot import (
    DEFAULT_PATH as DEFAULT_PUBLIC_SNAPSHOT_PATH,
)
from apps.listings.models import Listing
from apps.listings.public_listings import get_public_listing_queryset


def _load_fixture_source_urls(path: Path) -> set[str]:
    records = json.loads(path.read_text(encoding="utf-8"))
    return {
        (row.get("source_url") or "").strip()
        for row in records
        if (row.get("source_url") or "").strip()
    }


def _load_snapshot_source_urls(path: Path) -> set[str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get("listings", []) if isinstance(payload, dict) else []
    return {
        (row.get("source_url") or "").strip()
        for row in rows
        if (row.get("source_url") or "").strip()
    }


def _summarize_missing(listings):
    return [
        {
            "title": listing.title,
            "source_platform": listing.source_platform,
            "source_url": listing.source_url,
        }
        for listing in listings
    ]


class Command(BaseCommand):
    help = (
        "Verify that recently scraped listings are present in the production fixture "
        "and that recently visible listings are present in the public snapshot."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            default=DEFAULT_PATH,
            help="Path to the production fixture JSON file.",
        )
        parser.add_argument(
            "--public-snapshot-path",
            default=DEFAULT_PUBLIC_SNAPSHOT_PATH,
            help="Path to the public listings snapshot JSON file.",
        )
        parser.add_argument(
            "--frontend-snapshot-path",
            help="Optional frontend generated snapshot file to compare against the backend snapshot.",
        )
        parser.add_argument(
            "--lookback-hours",
            type=int,
            default=24,
            help="How many recent hours to inspect for newly scraped listings.",
        )

    def handle(self, *args, **options):
        fixture_path = Path(options["path"])
        snapshot_path = Path(options["public_snapshot_path"])
        frontend_snapshot_path = options.get("frontend_snapshot_path")

        missing_files = [
            str(path)
            for path in (fixture_path, snapshot_path)
            if not path.exists()
        ]
        if missing_files:
            raise CommandError(f"Sync verification files not found: {', '.join(missing_files)}")

        cutoff = timezone.now() - timedelta(hours=options["lookback_hours"])
        recent_qs = Listing.objects.filter(created_at__gte=cutoff).order_by("created_at")
        recent_public_qs = get_public_listing_queryset(only_approved=True).filter(created_at__gte=cutoff)

        fixture_source_urls = _load_fixture_source_urls(fixture_path)
        snapshot_source_urls = _load_snapshot_source_urls(snapshot_path)

        recent_listings = list(recent_qs)
        recent_public_listings = list(recent_public_qs)

        missing_from_fixture = [
            listing for listing in recent_listings
            if listing.source_url not in fixture_source_urls
        ]
        missing_from_snapshot = [
            listing for listing in recent_public_listings
            if listing.source_url not in snapshot_source_urls
        ]

        frontend_mismatch = False
        if frontend_snapshot_path:
            frontend_path = Path(frontend_snapshot_path)
            if not frontend_path.exists():
                raise CommandError(f"Frontend snapshot file not found: {frontend_path}")
            frontend_mismatch = (
                frontend_path.read_text(encoding="utf-8")
                != snapshot_path.read_text(encoding="utf-8")
            )

        self.stdout.write(
            "Sync verification: "
            f"recent_listings={len(recent_listings)} "
            f"recent_public_listings={len(recent_public_listings)} "
            f"fixture_entries={len(fixture_source_urls)} "
            f"snapshot_entries={len(snapshot_source_urls)}"
        )

        errors = []
        if missing_from_fixture:
            errors.append(
                "Missing from fixture: "
                + json.dumps(_summarize_missing(missing_from_fixture), ensure_ascii=False)
            )
        if missing_from_snapshot:
            errors.append(
                "Missing from public snapshot: "
                + json.dumps(_summarize_missing(missing_from_snapshot), ensure_ascii=False)
            )
        if frontend_mismatch:
            errors.append("Frontend snapshot does not match backend public snapshot export.")

        if errors:
            raise CommandError(" | ".join(errors))

        self.stdout.write(self.style.SUCCESS("Production listing sync verification passed."))
