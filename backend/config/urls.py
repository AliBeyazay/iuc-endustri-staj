from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenRefreshView,
)
from apps.listings.serializers import CustomTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

urlpatterns = [
    path('admin/', admin.site.urls),

    # JWT auth (email+password login)
    path('api/auth/login/',   CustomTokenObtainPairView.as_view(),  name='token_obtain'),
    path('api/auth/refresh/', TokenRefreshView.as_view(),     name='token_refresh'),

    # App API routes
    path('api/', include('apps.listings.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
