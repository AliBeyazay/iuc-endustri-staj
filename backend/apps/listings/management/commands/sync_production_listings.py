from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db.models import Count, Q
from django.utils import timezone

from apps.listings.management.commands.export_listings import DEFAULT_PATH
from apps.listings.models import Listing


def get_platform_summary():
    return list(
        Listing.objects.values("source_platform")
        .annotate(
            total=Count("id"),
            active=Count("id", filter=Q(is_active=True)),
            visible=Count(
                "id",
                filter=Q(
                    is_active=True,
                    canonical_listing__isnull=True,
                    moderation_status="approved",
                ),
            ),
        )
        .order_by("source_platform")
    )


class Command(BaseCommand):
    help = "Run local scrapers and refresh the production listings fixture."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            default=DEFAULT_PATH,
            help="Path to the production fixture JSON file.",
        )
        parser.add_argument(
            "--spider",
            type=str,
            help="Run only a specific spider before exporting the fixture.",
        )
        parser.add_argument(
            "--no-deactivate",
            action="store_true",
            help="Skip deactivating expired listings while running scrapers.",
        )

    def handle(self, *args, **options):
        started = timezone.now()
        target_path = Path(options["path"])
        target_path.parent.mkdir(parents=True, exist_ok=True)

        self.stdout.write(
            self.style.SUCCESS(
                f"[{started:%Y-%m-%d %H:%M:%S}] Production fixture sync started"
            )
        )

        run_scrapers_kwargs = {"stdout": self.stdout}
        if options.get("spider"):
            run_scrapers_kwargs["spider"] = options["spider"]
        if options.get("no_deactivate"):
            run_scrapers_kwargs["no_deactivate"] = True

        call_command("run_scrapers", **run_scrapers_kwargs)
        call_command("audit_listing_deadlines", stdout=self.stdout)
        call_command("export_listings", path=str(target_path), stdout=self.stdout)

        summary_rows = get_platform_summary()
        total_listings = sum(row["total"] for row in summary_rows)
        active_listings = sum(row["active"] for row in summary_rows)
        visible_listings = sum(row["visible"] for row in summary_rows)
        finished = timezone.now()
        duration = (finished - started).total_seconds()

        self.stdout.write(
            self.style.SUCCESS(
                f"[{finished:%Y-%m-%d %H:%M:%S}] Production fixture sync finished in {duration:.0f}s"
            )
        )
        self.stdout.write(f"Fixture path: {target_path}")
        self.stdout.write(
            f"Listings summary: total={total_listings} active={active_listings} visible={visible_listings}"
        )

        if not summary_rows:
            self.stdout.write("Platform summary: no listings found")
            return

        self.stdout.write("Platform summary:")
        for row in summary_rows:
            self.stdout.write(
                "  "
                f"{row['source_platform']}: "
                f"total={row['total']} active={row['active']} visible={row['visible']}"
            )
