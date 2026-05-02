from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
from rest_framework_simplejwt.views import (
    TokenRefreshView,
)
from apps.listings.serializers import CustomTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


def healthcheck(_request):
    errors = {}

    try:
        connection.ensure_connection()
    except Exception as exc:
        errors['db'] = str(exc)

    cache_backend = settings.CACHES.get('default', {}).get('BACKEND', '')
    if 'redis' in cache_backend.lower():
        try:
            cache.set('__health__', '1', timeout=10)
            if cache.get('__health__') != '1':
                errors['redis'] = 'read/write mismatch'
        except Exception as exc:
            errors['redis'] = str(exc)

    if errors:
        return JsonResponse({'status': 'error', 'errors': errors}, status=503)
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('', healthcheck, name='root-healthcheck'),
    path('admin/', admin.site.urls),
    path('health/', healthcheck, name='healthcheck'),

    # JWT auth (email+password login)
    path('api/auth/login/',          CustomTokenObtainPairView.as_view(), name='token_obtain'),
    path('api/auth/token/refresh/',  TokenRefreshView.as_view(),          name='token_refresh'),
    path('api/auth/refresh/',        TokenRefreshView.as_view(),          name='token_refresh_legacy'),

    # App API routes
    path('api/', include('apps.listings.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
