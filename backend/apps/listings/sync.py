from django.db.models import Q, QuerySet

from .cache_keys import bump_listing_list_cache_version, get_listing_list_cache_version


def invalidate_listing_list_cache() -> int:
    return bump_listing_list_cache_version()


def invalidate_listing_list_cache_if_unchanged(previous_version: int) -> int:
    current_version = get_listing_list_cache_version()
    if current_version > previous_version:
        return current_version
    return invalidate_listing_list_cache()


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


def get_listing_group_queryset(queryset: QuerySet) -> QuerySet:
    from .models import Listing

    selected_ids: list[str] = []
    canonical_ids: list[str] = []
    for listing in queryset.only('id', 'canonical_listing_id'):
        selected_ids.append(str(listing.id))
        canonical_ids.append(str(listing.canonical_listing_id or listing.id))

    if not selected_ids:
        return Listing.objects.none()

    return Listing.objects.filter(
        Q(id__in=selected_ids)
        | Q(id__in=canonical_ids)
        | Q(canonical_listing_id__in=canonical_ids)
    )


def delete_listing_groups(queryset: QuerySet) -> int:
    group_queryset = get_listing_group_queryset(queryset)
    group_ids = list(group_queryset.values_list('id', flat=True))
    if not group_ids:
        return 0

    cache_version_before_delete = get_listing_list_cache_version()
    _, deleted_breakdown = group_queryset.model.objects.filter(id__in=group_ids).delete()
    deleted_count = deleted_breakdown.get(group_queryset.model._meta.label, 0)
    if deleted_count:
        invalidate_listing_list_cache_if_unchanged(cache_version_before_delete)
    return deleted_count
