from datetime import date

from django.contrib.admin.models import DELETION, LogEntry
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.db.models import Avg, CharField, Count, FloatField, Q, Value
from django.db.models.functions import Coalesce, Concat

from .cache_keys import get_listing_list_cache_version
from .models import Listing, NegativeKeyword

NEGATIVE_KEYWORDS_CACHE_TTL = 300
DELETED_LISTING_REPRS_CACHE_TTL = 300


def get_negative_keywords() -> list[str]:
    cache_key = 'negative_keywords_list'
    try:
        keywords = cache.get(cache_key)
    except Exception:
        keywords = None

    if keywords is None:
        try:
            keywords = list(NegativeKeyword.objects.values_list('keyword', flat=True))
        except Exception:
            keywords = []
        try:
            cache.set(cache_key, keywords, timeout=NEGATIVE_KEYWORDS_CACHE_TTL)
        except Exception:
            pass

    return keywords


def get_deleted_listing_object_reprs() -> list[str]:
    cache_version = get_listing_list_cache_version()
    cache_key = f'deleted_listing_object_reprs:v{cache_version}'
    try:
        deleted_reprs = cache.get(cache_key)
    except Exception:
        deleted_reprs = None

    if deleted_reprs is None:
        try:
            content_type = ContentType.objects.get_for_model(Listing)
            deleted_reprs = list(
                LogEntry.objects.filter(
                    content_type=content_type,
                    action_flag=DELETION,
                )
                .values_list('object_repr', flat=True)
                .distinct()
            )
        except Exception:
            deleted_reprs = []

        try:
            cache.set(cache_key, deleted_reprs, timeout=DELETED_LISTING_REPRS_CACHE_TTL)
        except Exception:
            pass

    return deleted_reprs


def get_public_listing_queryset(*, only_approved: bool = False, only_featured: bool = False):
    queryset = Listing.objects.filter(is_active=True)

    if only_approved:
        queryset = queryset.filter(moderation_status='approved')
    if only_featured:
        queryset = queryset.filter(is_homepage_featured=True)

    queryset = queryset.filter(canonical_listing__isnull=True)
    queryset = queryset.exclude(deadline_status='expired')
    queryset = queryset.exclude(application_deadline__lt=date.today())

    negative_filters = Q()
    for keyword in get_negative_keywords():
        negative_filters |= Q(title__icontains=keyword) | Q(company_name__icontains=keyword)
    if negative_filters:
        queryset = queryset.exclude(negative_filters)

    queryset = queryset.exclude(title__contains='?').exclude(company_name__contains='?')

    deleted_object_reprs = get_deleted_listing_object_reprs()
    if deleted_object_reprs:
        queryset = queryset.annotate(
            admin_object_repr=Concat(
                'title',
                Value(' - '),
                'company_name',
                output_field=CharField(),
            )
        ).exclude(admin_object_repr__in=deleted_object_reprs)

    return queryset


def get_ordering_aggregate_annotations(requested_ordering: str):
    requested_fields = {
        item.strip().lstrip('-')
        for item in requested_ordering.split(',')
        if item.strip()
    }

    annotations = {}
    if 'bookmark_count' in requested_fields:
        annotations['bookmark_count'] = Count('bookmarked_by', distinct=True)
    if 'average_rating' in requested_fields:
        annotations['average_rating'] = Coalesce(
            Avg('reviews__rating'),
            Value(0.0),
            output_field=FloatField(),
        )
    return annotations
