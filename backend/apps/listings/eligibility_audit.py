from collections import Counter

from django.utils import timezone

from apps.listings.eligibility import classify_student_eligibility
from apps.listings.models import Listing
from apps.listings.sync import invalidate_listing_list_cache


def audit_listing_eligibility(queryset=None) -> dict[str, int]:
    queryset = queryset or Listing.objects.filter(is_active=True)
    summary = Counter()
    changed_listings = []
    updated_at = timezone.now()

    for listing in queryset.iterator():
        summary["processed"] += 1
        decision = classify_student_eligibility(listing.title, listing.description)

        if not decision.graduate_only:
            summary["eligible"] += 1
            continue

        summary["graduate_only"] += 1
        if decision.reason:
            summary[f"reason_{decision.reason}"] += 1

        if not listing.is_active:
            continue

        listing.is_active = False
        listing.updated_at = updated_at
        changed_listings.append(listing)
        summary["deactivated"] += 1

    if changed_listings:
        Listing.objects.bulk_update(changed_listings, ["is_active", "updated_at"])
        invalidate_listing_list_cache()
        summary["updated"] = len(changed_listings)

    return dict(summary)

