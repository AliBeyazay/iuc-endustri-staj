from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ListingViewSet, ReviewViewSet, BookmarkViewSet, ApplicationViewSet, InternshipJournalViewSet, JournalCommentViewSet,
    ProfileView, CVUploadView, DashboardStatsView, EncodingQualityReportView, ScraperHealthReportView,
    HomepageFeaturedListingsView,
    AdminListingModerationListView, AdminListingModerationDetailView, AdminListingBulkDeleteView,
    NotificationPreferencesView,
    CheckEmailView, AccountStatusView, RegisterView, VerifyOTPView,
    ResendOTPView, ForgotPasswordView, ResetPasswordView,
)

router = DefaultRouter()
router.register('listings',  ListingViewSet,  basename='listing')
router.register('reviews',   ReviewViewSet,   basename='review')
router.register('bookmarks', BookmarkViewSet, basename='bookmark')
router.register('applications', ApplicationViewSet, basename='application')
router.register('journals', InternshipJournalViewSet, basename='journal')
router.register('journal-comments', JournalCommentViewSet, basename='journal-comment')

urlpatterns = [
    path('', include(router.urls)),
    path('homepage/featured-listings/', HomepageFeaturedListingsView.as_view()),

    # Profile
    path('profile/',     ProfileView.as_view()),
    path('profile/cv/',  CVUploadView.as_view()),
    path('profile/notifications/', NotificationPreferencesView.as_view()),

    # Dashboard
    path('dashboard/stats/', DashboardStatsView.as_view()),
    path('dashboard/encoding-quality/', EncodingQualityReportView.as_view()),
    path('dashboard/scraper-health/', ScraperHealthReportView.as_view()),
    path('dashboard/admin/listings/', AdminListingModerationListView.as_view()),
    path('dashboard/admin/listings/bulk-delete/', AdminListingBulkDeleteView.as_view()),
    path('dashboard/admin/listings/<uuid:listing_id>/', AdminListingModerationDetailView.as_view()),

    # Auth
    path('auth/check-email/',       CheckEmailView.as_view()),
    path('auth/account-status/',    AccountStatusView.as_view()),
    path('auth/register/',          RegisterView.as_view()),
    path('auth/verify-otp/',        VerifyOTPView.as_view()),
    path('auth/resend-otp/',        ResendOTPView.as_view()),
    path('auth/forgot-password/',   ForgotPasswordView.as_view()),
    path('auth/reset-password/',    ResetPasswordView.as_view()),
]
