# ════════════════════════════════════════════════════════════════════
# config/throttle.py - Safe throttle classes resilient to Redis failures
# ════════════════════════════════════════════════════════════════════
"""
Throttle classes that gracefully handle cache failures (e.g., Redis unavailable).
Falls back to no throttling if cache is unreachable, preventing 500 errors.
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle, ScopedRateThrottle
import logging

logger = logging.getLogger(__name__)


class SafeAnonRateThrottle(AnonRateThrottle):
    """Anonymous user rate throttle with cache failure resilience."""
    
    def allow_request(self, request, view):
        """Override to catch and log cache errors."""
        try:
            return super().allow_request(request, view)
        except Exception as e:
            logger.warning(f"AnonRateThrottle cache error: {e}. Allowing request.")
            return True


class SafeUserRateThrottle(UserRateThrottle):
    """Authenticated user rate throttle with cache failure resilience."""
    
    def allow_request(self, request, view):
        """Override to catch and log cache errors."""
        try:
            return super().allow_request(request, view)
        except Exception as e:
            logger.warning(f"UserRateThrottle cache error: {e}. Allowing request.")
            return True


class SafeScopedRateThrottle(ScopedRateThrottle):
    """Scoped rate throttle with cache failure resilience."""
    
    def allow_request(self, request, view):
        """Override to catch and log cache errors."""
        try:
            return super().allow_request(request, view)
        except Exception as e:
            logger.warning(f"ScopedRateThrottle cache error: {e}. Allowing request.")
            return True
