from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ListingViewSet, ReviewViewSet, BookmarkViewSet,
    ProfileView, CVUploadView, DashboardStatsView,
    NotificationPreferencesView,
    CheckEmailView, AccountStatusView, RegisterView, VerifyOTPView,
    ResendOTPView, ForgotPasswordView, ResetPasswordView,
)

router = DefaultRouter()
router.register('listings',  ListingViewSet,  basename='listing')
router.register('reviews',   ReviewViewSet,   basename='review')
router.register('bookmarks', BookmarkViewSet, basename='bookmark')

urlpatterns = [
    path('', include(router.urls)),

    # Profile
    path('profile/',     ProfileView.as_view()),
    path('profile/cv/',  CVUploadView.as_view()),
    path('profile/notifications/', NotificationPreferencesView.as_view()),

    # Dashboard
    path('dashboard/stats/', DashboardStatsView.as_view()),

    # Auth
    path('auth/check-email/',       CheckEmailView.as_view()),
    path('auth/account-status/',    AccountStatusView.as_view()),
    path('auth/register/',          RegisterView.as_view()),
    path('auth/verify-otp/',        VerifyOTPView.as_view()),
    path('auth/resend-otp/',        ResendOTPView.as_view()),
    path('auth/forgot-password/',   ForgotPasswordView.as_view()),
    path('auth/reset-password/',    ResetPasswordView.as_view()),
]
