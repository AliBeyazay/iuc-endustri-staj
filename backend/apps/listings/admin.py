from django.contrib import admin
from django.utils.html import format_html
from .models import Listing, Review, Bookmark, Student, ScraperLog


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display  = ['iuc_email', 'get_full_name', 'student_no', 'department_year', 'is_verified']
    list_filter   = ['is_verified', 'department_year']
    search_fields = ['iuc_email', 'first_name', 'last_name', 'student_no']

    def get_full_name(self, obj):
        return f'{obj.first_name} {obj.last_name}'.strip()
    get_full_name.short_description = 'Ad Soyad'


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display  = ['title', 'company_name', 'em_focus_area', 'source_platform',
                     'deadline_status', 'is_active', 'is_talent_program', 'created_at']
    list_filter   = ['is_active', 'is_talent_program', 'em_focus_area',
                     'source_platform', 'internship_type', 'company_origin', 'deadline_status']
    search_fields = ['title', 'company_name', 'location']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering      = ['-created_at']

    actions = ['activate_listings', 'deactivate_listings']

    def activate_listings(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} ilan aktifleştirildi.')
    activate_listings.short_description = 'Seçili ilanları aktifleştir'

    def deactivate_listings(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} ilan pasifleştirildi.')
    deactivate_listings.short_description = 'Seçili ilanları pasifleştir'


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display  = ['listing', 'rating', 'internship_year', 'is_anonymous', 'created_at']
    list_filter   = ['rating', 'internship_year', 'is_anonymous']
    search_fields = ['listing__title', 'listing__company_name', 'comment']


@admin.register(Bookmark)
class BookmarkAdmin(admin.ModelAdmin):
    list_display  = ['student', 'listing', 'bookmarked_at']
    search_fields = ['student__iuc_email', 'listing__title']


@admin.register(ScraperLog)
class ScraperLogAdmin(admin.ModelAdmin):
    list_display   = ['spider_name', 'started_at', 'finished_at',
                      'new_count', 'updated_count', 'skipped_count', 'error_count']
    list_filter    = ['spider_name']
    readonly_fields = ['spider_name', 'started_at', 'finished_at',
                       'new_count', 'updated_count', 'skipped_count',
                       'error_count', 'error_log']
    ordering = ['-started_at']

    def has_add_permission(self, request):
        return False
