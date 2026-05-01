from collections import Counter
from datetime import date, timedelta

from django.utils import timezone

from apps.listings.deadlines import extract_deadline_from_remote_page, extract_deadline_from_text
from apps.listings.models import Listing
from apps.listings.sync import invalidate_listing_list_cache

STALE_UNKNOWN_DAYS = 90
URGENT_WINDOW_DAYS = 7


def compute_deadline_status(deadline: date | None) -> str:
    if deadline is None:
        return "unknown"

    if isinstance(deadline, str):
        try:
            deadline = date.fromisoformat(deadline)
        except (ValueError, TypeError):
            return "unknown"

    today = date.today()
    if deadline < today:
        return "expired"
    if deadline <= today + timedelta(days=URGENT_WINDOW_DAYS):
        return "urgent"
    return "normal"


def audit_listing_deadlines(queryset=None) -> dict[str, int]:
    queryset = queryset or Listing.objects.all()
    today = date.today()
    stale_cutoff = today - timedelta(days=STALE_UNKNOWN_DAYS)
    html_cache: dict[str, str] = {}
    summary = Counter()
    changed_listings = []
    updated_at = timezone.now()

    for listing in queryset.iterator():
        summary["processed"] += 1

        original_deadline = listing.application_deadline
        original_status = listing.deadline_status
        original_is_active = listing.is_active
        next_deadline = original_deadline

        if next_deadline is None and listing.application_url:
            remote_deadline = extract_deadline_from_remote_page(
                listing.application_url,
                allow_past=True,
                html_cache=html_cache,
            )
            if remote_deadline is not None:
                next_deadline = remote_deadline
                summary["recovered_from_application_url"] += 1

        if next_deadline is None:
            description_deadline = extract_deadline_from_text(listing.description or "", allow_past=True)
            if description_deadline is not None:
                next_deadline = description_deadline
                summary["recovered_from_description"] += 1

        if next_deadline is not None:
            next_status = compute_deadline_status(next_deadline)
            next_is_active = False if next_status == "expired" else original_is_active
            if next_status == "expired" and original_is_active:
                summary["deactivated_expired"] += 1
        else:
            next_status = "upcoming" if original_status == "upcoming" else "unknown"
            next_is_active = original_is_active
            if next_status != "upcoming" and original_is_active and listing.created_at.date() < stale_cutoff:
                next_status = "expired"
                next_is_active = False
                summary["deactivated_stale"] += 1

        summary[f"final_status_{next_status}"] += 1

        if (
            next_deadline == original_deadline
            and next_status == original_status
            and next_is_active == original_is_active
        ):
            continue

        listing.application_deadline = next_deadline
        listing.deadline_status = next_status
        listing.is_active = next_is_active
        listing.updated_at = updated_at
        changed_listings.append(listing)

    if changed_listings:
        Listing.objects.bulk_update(
            changed_listings,
            ["application_deadline", "deadline_status", "is_active", "updated_at"],
        )
        invalidate_listing_list_cache()
        summary["updated"] = len(changed_listings)

    return dict(summary)
