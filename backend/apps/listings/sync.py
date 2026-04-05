from django.db.models import QuerySet

from .cache_keys import bump_listing_list_cache_version


def invalidate_listing_list_cache() -> int:
    return bump_listing_list_cache_version()


def update_listing_queryset(queryset: QuerySet, **updates) -> int:
    updated_count = queryset.update(**updates)
    if updated_count:
        invalidate_listing_list_cache()
    return updated_count


def suppress_listing_source(listing, *, reason: str = 'manual_delete') -> bool:
    source_url = getattr(listing, 'source_url', '')
    if not source_url:
        return False

    from .models import SuppressedListingSource

    SuppressedListingSource.objects.update_or_create(
        source_url=source_url,
        defaults={
            'source_platform': getattr(listing, 'source_platform', '') or '',
            'listing_title': getattr(listing, 'title', '') or '',
            'company_name': getattr(listing, 'company_name', '') or '',
            'suppressed_reason': reason,
        },
    )
    return True
