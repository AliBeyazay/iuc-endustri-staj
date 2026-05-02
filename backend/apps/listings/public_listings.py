from datetime import date

from django.contrib.admin.models import DELETION, LogEntry
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.db.models import BooleanField
from django.db.models.expressions import RawSQL

from .cache_keys import get_listing_list_cache_version
from .models import Listing, NegativeKeyword

NEGATIVE_KEYWORDS_CACHE_TTL = 300
DELETED_LISTING_IDS_CACHE_TTL = 300


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


def get_deleted_listing_ids() -> list[str]:
    cache_version = get_listing_list_cache_version()
    cache_key = f'deleted_listing_ids:v{cache_version}'
    try:
        deleted_ids = cache.get(cache_key)
    except Exception:
        deleted_ids = None

    if deleted_ids is None:
        try:
            content_type = ContentType.objects.get_for_model(Listing)
            deleted_ids = list(
                LogEntry.objects.filter(
                    content_type=content_type,
                    action_flag=DELETION,
                )
                .values_list('object_id', flat=True)
                .distinct()
            )
        except Exception:
            deleted_ids = []

        try:
            cache.set(cache_key, deleted_ids, timeout=DELETED_LISTING_IDS_CACHE_TTL)
        except Exception:
            pass

    return deleted_ids


def get_public_listing_queryset(*, only_approved: bool = False, only_featured: bool = False):
    queryset = Listing.objects.filter(is_active=True)

    if only_approved:
        queryset = queryset.filter(moderation_status='approved')
    if only_featured:
        queryset = queryset.filter(is_homepage_featured=True)

    queryset = queryset.filter(canonical_listing__isnull=True)
    queryset = queryset.exclude(deadline_status='expired')
    queryset = queryset.exclude(application_deadline__lt=date.today())

    if get_negative_keywords():
        listing_table = Listing._meta.db_table
        negative_keyword_table = NegativeKeyword._meta.db_table
        negative_keyword_exists_sql = f"""
            EXISTS (
                SELECT 1
                FROM {negative_keyword_table} nk
                WHERE LOWER({listing_table}.title) LIKE '%%' || LOWER(nk.keyword) || '%%'
                   OR LOWER({listing_table}.company_name) LIKE '%%' || LOWER(nk.keyword) || '%%'
            )
        """
        queryset = queryset.annotate(
            has_negative_keyword=RawSQL(
                negative_keyword_exists_sql,
                [],
                output_field=BooleanField(),
            )
        ).filter(has_negative_keyword=False)

    queryset = queryset.exclude(title__contains='?').exclude(company_name__contains='?')

    deleted_ids = get_deleted_listing_ids()
    if deleted_ids:
        queryset = queryset.exclude(id__in=deleted_ids)

    return queryset

