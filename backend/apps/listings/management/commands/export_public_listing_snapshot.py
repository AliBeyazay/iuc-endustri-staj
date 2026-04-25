import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db.models import Avg, Count, FloatField, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.listings.public_listings import get_public_listing_queryset
from apps.listings.serializers import HomepageFeaturedListingSerializer, ListingSerializer

DEFAULT_PATH = "apps/listings/fixtures/public_listings_snapshot.json"


class Command(BaseCommand):
    help = "Export the public listings snapshot used by frontend fallbacks."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            default=DEFAULT_PATH,
            help="Path for the public listings snapshot JSON file.",
        )

    def handle(self, *args, **options):
        listings_qs = (
            get_public_listing_queryset()
            .order_by('-created_at')
        )
        featured_qs = (
            get_public_listing_queryset(only_approved=True, only_featured=True)
            .order_by('homepage_featured_rank', '-created_at')[:3]
        )

        listing_rows = list(ListingSerializer(listings_qs, many=True).data)
        for row, listing in zip(listing_rows, listings_qs):
            row['bookmark_count'] = int(getattr(listing, 'bookmark_count', 0) or 0)
            row['average_rating'] = float(getattr(listing, 'average_rating', 0.0) or 0.0)

        payload = {
            "generated_at": timezone.now().isoformat(),
            "count": len(listing_rows),
            "listings": listing_rows,
            "featured_listings": list(HomepageFeaturedListingSerializer(featured_qs, many=True).data),
        }

        out = Path(options["path"])
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Exported public snapshot with {len(listing_rows)} listings to {out}"))
