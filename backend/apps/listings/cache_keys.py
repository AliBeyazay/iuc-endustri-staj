from django.core.cache import cache


LISTING_LIST_CACHE_VERSION_KEY = 'listing-list-version'
DEFAULT_LISTING_LIST_CACHE_VERSION = 1


def get_listing_list_cache_version() -> int:
    try:
        version = cache.get(LISTING_LIST_CACHE_VERSION_KEY)
    except Exception:
        return DEFAULT_LISTING_LIST_CACHE_VERSION

    if isinstance(version, int) and version > 0:
        return version
    return DEFAULT_LISTING_LIST_CACHE_VERSION


def bump_listing_list_cache_version() -> int:
    next_version = get_listing_list_cache_version() + 1
    try:
        cache.set(LISTING_LIST_CACHE_VERSION_KEY, next_version, timeout=None)
    except Exception:
        pass
    return next_version
