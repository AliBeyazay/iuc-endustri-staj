import hashlib
import json as _json
import logging
import os
import random
import re
import secrets
import urllib.request
from urllib.parse import urlencode
from collections import Counter
from datetime import date, timedelta

logger = logging.getLogger(__name__)

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.utils.timezone import now
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from config.throttle import SafeScopedRateThrottle

from .cache_keys import get_listing_list_cache_version
from .filters import FuzzySearchFilter, ListingFilter
from .models import Application, Bookmark, Listing, Review, ScraperLog, SearchLog, Student
from .pagination import ListingPageNumberPagination
from .public_listings import get_public_listing_queryset
from .storage import upload_cv
from .sync import delete_listing_groups, invalidate_listing_list_cache_if_unchanged
from .serializers import (
    AdminListingListSerializer,
    AdminListingUpdateSerializer,
    ApplicationListSerializer,
    ApplicationWriteSerializer,
    BookmarkSerializer,
    HomepageFeaturedListingSerializer,
    ListingListSerializer,
    ListingSerializer,
    NotificationPreferencesSerializer,
    RegisterSerializer,
    ReviewSerializer,
    StudentProfileSerializer,
)

LISTING_LIST_CACHE_TTL_SECONDS = 300
HOMEPAGE_FEATURED_CACHE_TTL_SECONDS = 300
ENCODING_QUALITY_CACHE_TTL_SECONDS = 300
CACHEABLE_LIST_QUERY_PARAMS = frozenset({
    'page',
    'limit',
    'ordering',
    'em_focus_area',
    'internship_type',
    'company_origin',
    'source_platform',
    'is_talent_program',
    'deadline_status',
})
UNCACHEABLE_LIST_QUERY_PARAMS = frozenset({
    'search',
    'exclude',
    'location',
})


class ListingViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Listing.objects.filter(is_active=True)
    filter_backends = [DjangoFilterBackend, FuzzySearchFilter, filters.OrderingFilter]
    filterset_class = ListingFilter
    pagination_class = ListingPageNumberPagination
    search_fields = ['title', 'company_name', 'location', 'requirements']
    ordering_fields = [
        'created_at',
        'application_deadline',
        'company_name',
        'em_focus_confidence',
        'bookmark_count',
        'average_rating',
    ]
    ordering = ['-created_at']

    # Endüstri mühendisliğiyle ilgisiz ilanları filtrele (DB'den, 5dk cache)
    # Public listing filters live in apps.listings.public_listings.
    def get_serializer_class(self):
        if self.action == 'list':
            return ListingListSerializer
        return ListingSerializer

    def get_queryset(self):
        # get_public_listing_queryset() already applies:
        #   - Süresi geçmiş ilanları gizleme  (deadline_status='expired' veya application_deadline < bugün)
        #   - Negatif anahtar kelime filtresi  (NegativeKeyword modeli, cache'li)
        #   - Bozuk encoding gizleme           (title/company_name '?' içerenleri dışlar)
        qs = get_public_listing_queryset()
        exclude_id = self.request.query_params.get('exclude')
        if exclude_id:
            qs = qs.exclude(id=exclude_id)

        # bookmark_count ve average_rating artık denormalize model alanı — annotation yok.
        return qs

    def list(self, request, *args, **kwargs):
        try:
            cache_key = self._get_list_cache_key(request)
            cached_payload = None
            if cache_key is not None:
                try:
                    cached_payload = cache.get(cache_key)
                except Exception:
                    cached_payload = None

            if cached_payload is not None:
                return Response(cached_payload)

            response = super().list(request, *args, **kwargs)
            if response.status_code == status.HTTP_200_OK:
                if cache_key is not None:
                    try:
                        cache.set(cache_key, response.data, timeout=LISTING_LIST_CACHE_TTL_SECONDS)
                    except Exception:
                        pass
                try:
                    query = request.query_params.get('search', '').strip()
                    if query:
                        count = response.data.get('count', 0) if isinstance(response.data, dict) else 0
                        filters_applied = {
                            k: v for k, v in request.query_params.items()
                            if k not in ('search', 'page', 'limit', 'ordering')
                        }
                        SearchLog.objects.create(
                            query=query,
                            result_count=count,
                            filters_applied=filters_applied,
                            has_results=count > 0,
                        )
                except Exception:
                    pass
            return response
        except Exception:
            logger.exception('ListingViewSet.list() failed')
            return Response(
                {'error': 'İlan listesi alınamadı.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _get_list_cache_key(self, request) -> str:
        fingerprint = self._get_cacheable_list_fingerprint(request)
        if fingerprint is None:
            return None
        digest = hashlib.md5(fingerprint.encode('utf-8')).hexdigest()
        cache_version = get_listing_list_cache_version()
        return f'listing-list:v{cache_version}:{digest}'

    def _get_cacheable_list_fingerprint(self, request) -> str | None:
        query_params = request.query_params
        param_keys = set(query_params.keys())

        if param_keys & UNCACHEABLE_LIST_QUERY_PARAMS:
            return None
        if param_keys - CACHEABLE_LIST_QUERY_PARAMS:
            return None

        normalized_items = []
        for key in sorted(param_keys):
            values = [value for value in query_params.getlist(key) if value != '']
            if not values:
                continue
            if key not in {'page', 'limit', 'ordering'}:
                values = sorted(values)
            for value in values:
                normalized_items.append((key, value))

        return urlencode(normalized_items, doseq=True)

    def filter_queryset(self, queryset):
        # ?limit is now handled by ListingPageNumberPagination (page_size_query_param).
        # No manual slice here — keeps count/next/previous correct.
        return super().filter_queryset(queryset)

    @action(detail=False, methods=['get'])
    def facets(self, request):
        """
        Returns active-listing counts per em_focus_area and source_platform.
        Sector counts use the same OR logic as ListingFilter (primary OR secondary).
        Response is cached for 5 minutes.
        """
        cache_key = 'listing-facets'
        try:
            cached = cache.get(cache_key)
        except Exception:
            cached = None

        if cached is not None:
            return Response(cached)

        qs = get_public_listing_queryset()

        # Sector facets — a listing counts for sector X when either its
        # primary OR secondary em_focus_area equals X (mirrors the filter).
        sector_choices = [c[0] for c in Listing._meta.get_field('em_focus_area').choices]
        sector_facets = {
            key: qs.filter(
                Q(em_focus_area=key) | Q(secondary_em_focus_area=key)
            ).count()
            for key in sector_choices
        }

        # Platform facets — one query, grouped by source_platform.
        platform_facets = dict(
            qs.values('source_platform')
            .annotate(count=Count('id'))
            .values_list('source_platform', 'count')
        )

        data = {'em_focus_area': sector_facets, 'source_platform': platform_facets}

        try:
            cache.set(cache_key, data, timeout=LISTING_LIST_CACHE_TTL_SECONDS)
        except Exception:
            pass

        return Response(data)

    @action(detail=True, methods=['get'])
    def similar(self, request, pk=None):
        listing = self.get_object()
        qs = self.get_queryset().exclude(id=listing.id).select_related('canonical_listing')

        company = listing.company_name.strip().lower()

        # Extract city from location — skip work-model tokens that appear before
        # the city name (e.g. "Remote - İstanbul" → "İstanbul", not "Remote").
        _NON_CITY = {
            'remote', 'uzaktan', 'hibrit', 'hybrid', 'onsite',
            'ofis', 'yerinde', 'online', 'home', 'office',
        }
        loc = listing.location or ''
        loc_parts = [p.strip() for p in re.split(r'[,/()\-]', loc) if p.strip()]
        city = next(
            (p for p in loc_parts if p.lower() not in _NON_CITY and len(p) > 2),
            '',
        )

        # Title keywords (exclude short / common words)
        _STOP = {
            # Generic internship labels
            'staj', 'stajyer', 'stajyeri', 'intern', 'internship', 'trainee',
            # Seniority / role modifiers
            'junior', 'senior', 'lead', 'uzman', 'uzmanı', 'yetkili', 'asistan',
            'asistanı', 'koordinatör', 'koordinatörü', 'sorumlu', 'sorumlusu',
            # Common engineering titles that appear in almost every listing
            'mühendis', 'mühendisi', 'mühendislik', 'endüstri', 'endüstriyel',
            'tekniker', 'teknikeri', 'teknisyen',
            # Program / period markers
            'program', 'programı', 'programi', 'dönem', 'donemi', 'dönemi',
            'yaz', 'kış', 'guz', 'bahar', 'summer', 'winter',
            # Employment-type words
            'yarı', 'yari', 'zamanlı', 'zamanli', 'parttime', 'fulltime',
            'tam', 'remote', 'uzaktan', 'hibrit', 'hybrid', 'ofis',
            # Turkish conjunctions / prepositions
            've', 'ile', 'için', 'icin', 'veya', 'olan', 'olarak', 'gibi',
            'kadar', 'sonra', 'önce', 'once', 'üzere',
        }
        title_words = [
            w for w in re.split(r'\s+', listing.title.lower())
            if len(w) > 3 and w not in _STOP
        ][:5]

        # ── Scoring via annotations ──────────────────────────────
        # Weight rationale:
        #   company +20  — strongest signal; same employer = directly related role
        #   sector  +8/+5 — same field is highly relevant
        #   city    +6  — location matters to applicants
        #   type    +4  — zorunlu vs gönüllü is a hard constraint for many students
        #   origin  +3  — yerli/yabancı is a soft preference signal
        #   keyword +3  — title overlap is informative but should not overpower company
        # Max keyword contribution: 5 × 3 = 15 < company alone (20)
        score = Value(0, output_field=IntegerField())

        # Same company → +20
        score = score + Case(
            When(company_name__iexact=company, then=Value(20)),
            default=Value(0), output_field=IntegerField(),
        )

        # Same primary em_focus_area → +8
        score = score + Case(
            When(em_focus_area=listing.em_focus_area, then=Value(8)),
            default=Value(0), output_field=IntegerField(),
        )

        # Secondary focus cross-match → +5
        if listing.secondary_em_focus_area:
            score = score + Case(
                When(em_focus_area=listing.secondary_em_focus_area, then=Value(5)),
                When(secondary_em_focus_area=listing.em_focus_area, then=Value(5)),
                default=Value(0), output_field=IntegerField(),
            )
        else:
            score = score + Case(
                When(secondary_em_focus_area=listing.em_focus_area, then=Value(5)),
                default=Value(0), output_field=IntegerField(),
            )

        # Same city → +6
        if city and len(city) > 2:
            score = score + Case(
                When(location__icontains=city, then=Value(6)),
                default=Value(0), output_field=IntegerField(),
            )

        # Same internship type → +4 (skip when ambiguous)
        if listing.internship_type and listing.internship_type != 'belirsiz':
            score = score + Case(
                When(internship_type=listing.internship_type, then=Value(4)),
                default=Value(0), output_field=IntegerField(),
            )

        # Same company origin → +3 (skip when ambiguous)
        if listing.company_origin and listing.company_origin != 'belirsiz':
            score = score + Case(
                When(company_origin=listing.company_origin, then=Value(3)),
                default=Value(0), output_field=IntegerField(),
            )

        # Title keyword overlap → +3 each
        for word in title_words:
            score = score + Case(
                When(title__icontains=word, then=Value(3)),
                default=Value(0), output_field=IntegerField(),
            )

        results = list(
            qs.annotate(similarity_score=score)
            .filter(similarity_score__gt=0)
            .order_by('-similarity_score', '-created_at')[:6]
        )

        serializer = ListingListSerializer(results, many=True)
        data = serializer.data

        # Attach human-readable match reasons
        for item, obj in zip(data, results):
            reasons = []
            if obj.company_name.strip().lower() == company:
                reasons.append('company')
            if obj.em_focus_area == listing.em_focus_area:
                reasons.append('focus_area')
            sec = listing.secondary_em_focus_area
            if (sec and obj.em_focus_area == sec) or \
               obj.secondary_em_focus_area == listing.em_focus_area:
                reasons.append('secondary_focus')
            if city and len(city) > 2 and city.lower() in obj.location.lower():
                reasons.append('location')
            if listing.internship_type and listing.internship_type != 'belirsiz' \
               and obj.internship_type == listing.internship_type:
                reasons.append('internship_type')
            if listing.company_origin and listing.company_origin != 'belirsiz' \
               and obj.company_origin == listing.company_origin:
                reasons.append('company_origin')
            if any(w in obj.title.lower() for w in title_words):
                reasons.append('title')
            item['match_reasons'] = reasons

        return Response(data)

    @action(detail=True, methods=['get'])
    def reviews(self, request, pk=None):
        listing = self.get_object()
        serializer = ReviewSerializer(listing.reviews.all(), many=True)
        return Response({'results': serializer.data, 'average_rating': listing.average_rating})


class HomepageFeaturedListingsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cache_key = self._get_cache_key()
        try:
            cached_payload = cache.get(cache_key)
        except Exception:
            cached_payload = None

        if cached_payload is not None:
            return Response(cached_payload)

        featured_qs = get_public_listing_queryset(
            only_approved=True,
            only_featured=True,
        ).order_by('homepage_featured_rank', '-created_at')[:3]

        serializer = HomepageFeaturedListingSerializer(featured_qs, many=True)
        payload = serializer.data
        try:
            cache.set(cache_key, payload, timeout=HOMEPAGE_FEATURED_CACHE_TTL_SECONDS)
        except Exception:
            pass
        return Response(payload)

    def _get_cache_key(self) -> str:
        cache_version = get_listing_list_cache_version()
        return f'homepage-featured-listings:v{cache_version}'


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    throttle_classes = [SafeScopedRateThrottle]
    throttle_scope = 'review'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['listing']

    def get_queryset(self):
        return Review.objects.all()

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def update(self, request, *args, **kwargs):
        review = self.get_object()
        if review.student != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        review = self.get_object()
        if review.student != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        review = self.get_object()
        if review.student != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class BookmarkViewSet(viewsets.ModelViewSet):
    serializer_class = BookmarkSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = ListingPageNumberPagination

    def get_queryset(self):
        return Bookmark.objects.filter(student=self.request.user).select_related('listing')

    def destroy(self, request, *args, **kwargs):
        listing_id = kwargs.get('pk')
        Bookmark.objects.filter(student=request.user, listing_id=listing_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ApplicationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = ListingPageNumberPagination

    def get_queryset(self):
        return Application.objects.filter(student=self.request.user).select_related('listing')

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            return ApplicationListSerializer
        return ApplicationWriteSerializer



class ProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = StudentProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = StudentProfileSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class NotificationPreferencesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        prefs = request.user.notification_preferences or {}
        defaults = {'enabled': False, 'sectors': [], 'locations': []}
        return Response({**defaults, **prefs})

    def put(self, request):
        serializer = NotificationPreferencesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.notification_preferences = serializer.validated_data
        request.user.save(update_fields=['notification_preferences'])
        return Response(serializer.validated_data)


class CVUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        cv_file = request.FILES.get('cv')
        if not cv_file:
            return Response({'error': 'Dosya bulunamadi.'}, status=400)
        if cv_file.size > 5 * 1024 * 1024:
            return Response({'error': "Dosya 5MB'dan buyuk olamaz."}, status=400)
        if cv_file.content_type != 'application/pdf':
            return Response({'error': 'Sadece PDF yuklenebilir.'}, status=400)
        header = cv_file.read(5)
        cv_file.seek(0)
        if header != b'%PDF-':
            return Response({'error': 'Sadece PDF yuklenebilir.'}, status=400)

        try:
            cv_url = upload_cv(cv_file, str(request.user.id))
        except Exception as exc:
            return Response({'error': f'Dosya yuklenemedi: {exc}'}, status=500)

        request.user.cv_url = cv_url
        request.user.save(update_fields=['cv_url'])
        return Response({'cv_url': cv_url})


class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = date.today()
        cache_key = f"dashboard_global_stats_v{get_listing_list_cache_version()}"

        try:
            stats = cache.get(cache_key)
        except Exception:
            stats = None

        if stats is None:
            stats = {
                'total_active_listings': Listing.objects.filter(is_active=True).count(),
                'new_listings_today': Listing.objects.filter(
                    is_active=True,
                    created_at__date=today,
                ).count(),
                'listings_expiring_soon': Listing.objects.filter(
                    is_active=True,
                    application_deadline__lte=today + timedelta(days=7),
                    application_deadline__gte=today,
                ).count(),
            }
            try:
                cache.set(cache_key, stats, timeout=300)
            except Exception:
                pass

        return Response({
            **stats,
            'bookmarks_count': Bookmark.objects.filter(student=request.user).count(),
        })


class EncodingQualityReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    TEXT_FIELDS = ['title', 'company_name', 'location', 'description', 'requirements']
    SUSPECT_TOKENS = ['Ã', 'Å', 'Ä', '\ufffd', '�']
    QUESTION_MARK_RE = re.compile(r'[A-Za-zÇĞİÖŞÜçğıöşü]\?[A-Za-zÇĞİÖŞÜçğıöşü]')

    def get(self, request):
        cache_key = 'encoding-quality-report:v1'
        try:
            cached_payload = cache.get(cache_key)
        except Exception:
            cached_payload = None
        if cached_payload is not None:
            return Response(cached_payload)

        queryset = Listing.objects.filter(is_active=True).values(
            'id',
            'source_platform',
            'title',
            'company_name',
            'location',
            'description',
            'requirements',
        )

        total = 0
        corrupted_total = 0
        field_issue_counts: Counter[str] = Counter()
        token_counts: Counter[str] = Counter()
        platform_issue_counts: Counter[str] = Counter()
        samples = []

        for record in queryset.iterator(chunk_size=500):
            total += 1
            broken_fields = []
            token_hits = set()

            for field in self.TEXT_FIELDS:
                value = (record.get(field) or '').strip()
                if not value:
                    continue

                suspicious = False
                for token in self.SUSPECT_TOKENS:
                    if token in value:
                        suspicious = True
                        token_hits.add(token)
                if self.QUESTION_MARK_RE.search(value):
                    suspicious = True
                    token_hits.add('?')

                if suspicious:
                    broken_fields.append(field)
                    field_issue_counts[field] += 1

            if not broken_fields:
                continue

            corrupted_total += 1
            platform = record.get('source_platform') or 'unknown'
            platform_issue_counts[platform] += 1
            for token in token_hits:
                token_counts[token] += 1

            if len(samples) < 20:
                samples.append({
                    'id': str(record['id']),
                    'source_platform': platform,
                    'title': (record.get('title') or '')[:140],
                    'company_name': (record.get('company_name') or '')[:120],
                    'problem_fields': broken_fields,
                })

        corruption_rate = round((corrupted_total / total) * 100, 2) if total else 0.0
        payload = {
            'generated_at': now().isoformat(),
            'totals': {
                'total_listings_scanned': total,
                'corrupted_listings': corrupted_total,
                'clean_listings': max(total - corrupted_total, 0),
                'corruption_rate_percent': corruption_rate,
            },
            'field_issue_counts': dict(field_issue_counts),
            'token_issue_counts': dict(token_counts),
            'platform_issue_counts': dict(platform_issue_counts),
            'top_problem_platforms': [
                {'source_platform': platform, 'count': count}
                for platform, count in platform_issue_counts.most_common(8)
            ],
            'samples': samples,
        }

        try:
            cache.set(cache_key, payload, timeout=ENCODING_QUALITY_CACHE_TTL_SECONDS)
        except Exception:
            pass

        return Response(payload)


class ScraperHealthReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        window_hours = 24
        window_start = now() - timedelta(hours=window_hours)

        recent_logs = list(
            ScraperLog.objects.filter(started_at__gte=window_start)
            .order_by('-started_at')
            .values(
                'spider_name',
                'started_at',
                'finished_at',
                'new_count',
                'updated_count',
                'skipped_count',
                'error_count',
            )
        )

        latest_by_spider = {}
        all_spider_names = set(
            ScraperLog.objects.values_list('spider_name', flat=True).distinct()
        )
        all_spider_names.update(log['spider_name'] for log in recent_logs)

        for spider_name in sorted(all_spider_names):
            last_log = (
                ScraperLog.objects.filter(spider_name=spider_name)
                .order_by('-started_at')
                .values(
                    'spider_name',
                    'started_at',
                    'finished_at',
                    'new_count',
                    'updated_count',
                    'skipped_count',
                    'error_count',
                )
                .first()
            )
            if last_log is None:
                continue
            latest_by_spider[spider_name] = last_log

        spider_rows = []
        totals = {
            'spider_count': len(latest_by_spider),
            'window_hours': window_hours,
            'runs_in_window': len(recent_logs),
            'new_count': 0,
            'updated_count': 0,
            'skipped_count': 0,
            'error_count': 0,
            'error_rate_percent': 0.0,
        }

        for spider_name, latest in latest_by_spider.items():
            spider_logs = [log for log in recent_logs if log['spider_name'] == spider_name]
            run_count = len(spider_logs)
            new_count = sum(log.get('new_count', 0) for log in spider_logs)
            updated_count = sum(log.get('updated_count', 0) for log in spider_logs)
            skipped_count = sum(log.get('skipped_count', 0) for log in spider_logs)
            error_count = sum(log.get('error_count', 0) for log in spider_logs)
            processed = new_count + updated_count + skipped_count
            error_rate = round((error_count / processed) * 100, 2) if processed else 0.0

            totals['new_count'] += new_count
            totals['updated_count'] += updated_count
            totals['skipped_count'] += skipped_count
            totals['error_count'] += error_count

            last_duration_seconds = None
            if latest.get('finished_at') and latest.get('started_at'):
                duration = latest['finished_at'] - latest['started_at']
                last_duration_seconds = max(int(duration.total_seconds()), 0)

            spider_rows.append({
                'spider_name': spider_name,
                'last_started_at': latest.get('started_at'),
                'last_finished_at': latest.get('finished_at'),
                'last_duration_seconds': last_duration_seconds,
                'last_run': {
                    'new_count': latest.get('new_count', 0),
                    'updated_count': latest.get('updated_count', 0),
                    'skipped_count': latest.get('skipped_count', 0),
                    'error_count': latest.get('error_count', 0),
                },
                'window': {
                    'run_count': run_count,
                    'new_count': new_count,
                    'updated_count': updated_count,
                    'skipped_count': skipped_count,
                    'error_count': error_count,
                    'error_rate_percent': error_rate,
                },
            })

        processed_total = totals['new_count'] + totals['updated_count'] + totals['skipped_count']
        totals['error_rate_percent'] = round((totals['error_count'] / processed_total) * 100, 2) if processed_total else 0.0

        payload = {
            'generated_at': now().isoformat(),
            'totals': totals,
            'spiders': sorted(spider_rows, key=lambda row: row['spider_name']),
        }
        return Response(payload)


class AdminListingModerationListView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        queryset = Listing.objects.all().order_by('-created_at')
        search = (request.query_params.get('search') or '').strip()
        moderation_status = (request.query_params.get('moderation_status') or '').strip()

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(company_name__icontains=search)
                | Q(location__icontains=search)
            )

        if moderation_status in {'approved', 'rejected', 'pending'}:
            queryset = queryset.filter(moderation_status=moderation_status)

        limit_raw = request.query_params.get('limit', '200')
        try:
            limit = max(1, min(int(limit_raw), 500))
        except ValueError:
            limit = 200

        total_count = queryset.count()
        rows = queryset[:limit]
        serializer = AdminListingListSerializer(rows, many=True)
        return Response({'results': serializer.data, 'count': total_count})


class AdminListingModerationDetailView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, listing_id):
        listing = Listing.objects.filter(id=listing_id).first()
        if not listing:
            return Response({'error': 'İlan bulunamadı.'}, status=404)

        action = (request.data.get('action') or '').strip().lower()
        moderation_note = (request.data.get('moderation_note') or '').strip()

        if action == 'approve':
            listing.moderation_status = 'approved'
            listing.is_active = True
            if moderation_note:
                listing.moderation_note = moderation_note
            listing.moderated_at = now()
            cache_version_before_save = get_listing_list_cache_version()
            listing.save(update_fields=['moderation_status', 'is_active', 'moderation_note', 'moderated_at', 'updated_at'])
            invalidate_listing_list_cache_if_unchanged(cache_version_before_save)
            return Response(AdminListingListSerializer(listing).data)

        if action == 'reject':
            listing.moderation_status = 'rejected'
            listing.is_active = False
            if moderation_note:
                listing.moderation_note = moderation_note
            listing.moderated_at = now()
            cache_version_before_save = get_listing_list_cache_version()
            listing.save(update_fields=['moderation_status', 'is_active', 'moderation_note', 'moderated_at', 'updated_at'])
            invalidate_listing_list_cache_if_unchanged(cache_version_before_save)
            return Response(AdminListingListSerializer(listing).data)

        serializer = AdminListingUpdateSerializer(listing, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data
        update_fields = list(validated_data.keys())
        for field, value in validated_data.items():
            setattr(listing, field, value)
        if 'moderation_status' in validated_data:
            listing.moderated_at = now()
            update_fields.append('moderated_at')
        if update_fields:
            cache_version_before_save = get_listing_list_cache_version()
            listing.save(update_fields=update_fields + ['updated_at'])
            if {'moderation_status', 'is_active'} & validated_data.keys():
                invalidate_listing_list_cache_if_unchanged(cache_version_before_save)
        return Response(AdminListingListSerializer(listing).data)

    def delete(self, request, listing_id):
        listing = Listing.objects.filter(id=listing_id).first()
        if not listing:
            return Response({'error': 'İlan bulunamadı.'}, status=404)
        delete_listing_groups(Listing.objects.filter(id=listing.id))
        return Response(status=204)


class AdminListingBulkDeleteView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        ids = request.data.get('ids', [])
        if not isinstance(ids, list) or not ids:
            return Response({'error': 'Silinecek ilan ID listesi gerekli.'}, status=400)

        deleted_count = delete_listing_groups(Listing.objects.filter(id__in=ids))
        return Response({'deleted_count': deleted_count})


class CheckEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get('email', '') or '').strip().lower()
        available = not Student.objects.filter(iuc_email__iexact=email).exists()
        return Response({'available': available})


class AccountStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get('email', '') or '').strip().lower()
        try:
            student = Student.objects.get(iuc_email__iexact=email)
        except Student.DoesNotExist:
            return Response({'exists': False, 'is_verified': False})

        response_data = {
            'exists': True,
            'is_verified': student.is_verified,
        }

        if not student.is_verified:
            try:
                _send_otp(student)
            except Exception:
                return Response(
                    {'error': 'Doğrulama kodu gönderilemedi. Lütfen daha sonra tekrar deneyin.'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            response_data.update({
                'delivery_method': 'email',
            })

        return Response(response_data)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        names = data['full_name'].split(' ', 1)
        student = Student.objects.filter(iuc_email__iexact=data['email']).first()
        conflicting_student_no = Student.objects.filter(student_no=data.get('student_no')).exclude(
            iuc_email__iexact=data['email']
        ).first()

        if conflicting_student_no and conflicting_student_no.is_verified:
            return Response({'student_no': ['Bu öğrenci numarası zaten kayıtlı.']}, status=400)

        if student and student.is_verified:
            return Response({'email': ['Bu e-posta zaten kayıtlı.']}, status=400)

        if student is None:
            student = Student.objects.create_user(
                username=data['email'],
                iuc_email=data['email'],
                email=data['email'],
                password=data['password'],
                first_name=names[0],
                last_name=names[1] if len(names) > 1 else '',
                student_no=data.get('student_no'),
                department_year=data.get('department_year'),
                linkedin_url=data.get('linkedin_url') or None,
            )
        else:
            student.username = data['email']
            student.iuc_email = data['email']
            student.email = data['email']
            student.first_name = names[0]
            student.last_name = names[1] if len(names) > 1 else ''
            student.student_no = data.get('student_no')
            student.department_year = data.get('department_year')
            student.linkedin_url = data.get('linkedin_url') or None
            student.is_verified = False
            student.set_password(data['password'])
            student.save()

        try:
            _send_otp(student)
        except Exception:
            return Response(
                {'error': 'Doğrulama kodu gönderilemedi. Lütfen daha sonra tekrar deneyin.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        response_data = {
            'message': 'Kayıt başarılı. Doğrulama kodu e-posta adresinize gönderildi.',
            'delivery_method': 'email',
        }
        return Response(response_data, status=201)


class VerifyOTPView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [SafeScopedRateThrottle]
    throttle_scope = 'otp'

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        otp = request.data.get('otp')
        try:
            student = Student.objects.get(iuc_email__iexact=email)
        except Student.DoesNotExist:
            return Response({'error': 'Kullanici bulunamadi.'}, status=404)

        if not _verify_otp(student, otp):
            return Response({'error': 'Kod hatali veya suresi dolmus.'}, status=400)

        student.is_verified = True
        student.save(update_fields=['is_verified'])
        return Response({'message': 'E-posta dogrulandi.'})


class ResendOTPView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [SafeScopedRateThrottle]
    throttle_scope = 'otp_resend'

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        try:
            student = Student.objects.get(iuc_email__iexact=email)
        except Student.DoesNotExist:
            return Response({'error': 'Kullanici bulunamadi.'}, status=404)

        try:
            _send_otp(student)
        except Exception:
            return Response(
                {'error': 'Doğrulama kodu gönderilemedi. Lütfen daha sonra tekrar deneyin.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        response_data = {
            'message': 'OTP yeniden oluşturuldu ve e-posta adresinize gönderildi.',
            'delivery_method': 'email',
        }
        return Response(response_data)


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        try:
            student = Student.objects.get(iuc_email__iexact=email)
            _send_password_reset(student)
        except Student.DoesNotExist:
            pass
        return Response({'message': 'Sifirlama linki gonderildi.'})


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get('token')
        password = request.data.get('password')
        student = _verify_reset_token(token)
        if not student:
            return Response({'error': 'Geçersiz veya süresi dolmuş link.'}, status=400)
        student.set_password(password)
        student.save()
        return Response({'message': 'Şifre güncellendi.'})


def _send_otp(student: Student) -> None:
    """OTP üretip e-posta ile gönderir. SMTP hatasında exception fırlatır."""
    otp = str(random.randint(100000, 999999))
    _cache_set(f'otp:{student.iuc_email}', otp, timeout=600)
    try:
        send_mail(
            subject='IUC Staj - Doğrulama Kodu',
            message=f'İÜC Staj Platformu için doğrulama kodunuz: {otp}\n\nBu kod 10 dakika geçerlidir.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[student.iuc_email],
            fail_silently=False,
        )
    except Exception as exc:
        # Cache'deki OTP'yi temizle — gönderilemedi, kullanılmamalı
        _cache_delete(f'otp:{student.iuc_email}')
        raise exc


def _verify_otp(student: Student, otp: str) -> bool:
    stored = _cache_get(f'otp:{student.iuc_email}')
    if stored and stored == otp:
        _cache_delete(f'otp:{student.iuc_email}')
        return True
    return False


def _send_password_reset(student: Student):
    token = secrets.token_urlsafe(32)
    _cache_set(f'reset:{token}', str(student.id), timeout=900)
    reset_url = f'{settings.FRONTEND_URL}/reset-password?token={token}'
    send_mail(
        subject='IUC Staj - Şifre Sıfırlama',
        message=f'Şifrenizi sıfırlamak için: {reset_url}\n\nLink 15 dakika geçerlidir.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[student.iuc_email],
    )


def _verify_reset_token(token: str):
    student_id = _cache_get(f'reset:{token}')
    if not student_id:
        return None
    _cache_delete(f'reset:{token}')
    try:
        return Student.objects.get(id=student_id)
    except Student.DoesNotExist:
        return None


def _cache_set(key: str, value: str, *, timeout: int) -> None:
    # Redis hatası fırlatılsın — caller 503 dönmeli, bellekte fallback yok.
    # Birden fazla Gunicorn worker'da süreç-içi dict tutarsız doğrulamaya yol açar.
    cache.set(key, value, timeout=timeout)


def _cache_get(key: str):
    try:
        return cache.get(key)
    except Exception:
        return None


def _cache_delete(key: str) -> None:
    try:
        cache.delete(key)
    except Exception:
        pass


# ─── Google OAuth ─────────────────────────────────────────────────────────────

_IUC_DOMAINS = ('@ogr.iuc.edu.tr', '@iuc.edu.tr')


class GoogleSyncView(APIView):
    """
    POST /api/auth/google/
    Called server-side by NextAuth signIn callback to create/sync the
    Google-authenticated user in the Django database.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        name = (request.data.get('name') or '').strip()
        avatar_url = request.data.get('avatar_url') or None

        if not email or not any(email.endswith(d) for d in _IUC_DOMAINS):
            return Response({'error': 'Geçersiz e-posta'}, status=status.HTTP_400_BAD_REQUEST)

        first_name = name.split()[0] if name else email.split('@')[0].split('.')[0].title()
        last_name = ' '.join(name.split()[1:]) if name and len(name.split()) > 1 else ''

        user, _ = Student.objects.get_or_create(
            iuc_email=email,
            defaults={
                'username': email.split('@')[0],
                'first_name': first_name,
                'last_name': last_name,
                'is_verified': True,
                'is_active': True,
            },
        )

        update_fields = []
        if not user.is_verified:
            user.is_verified = True
            update_fields.append('is_verified')
        if avatar_url and user.avatar_url != avatar_url:
            user.avatar_url = avatar_url
            update_fields.append('avatar_url')
        if update_fields:
            user.save(update_fields=update_fields)

        return Response({'status': 'ok'})


class GoogleTokenView(APIView):
    """
    POST /api/auth/google/token/
    Called server-side by NextAuth jwt callback. Verifies the Google ID
    token with Google's tokeninfo endpoint, then issues Django JWT tokens.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from rest_framework_simplejwt.tokens import RefreshToken

        id_token = (request.data.get('id_token') or '').strip()
        if not id_token:
            return Response({'error': 'id_token gerekli'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            url = f'https://www.googleapis.com/oauth2/v3/tokeninfo?id_token={id_token}'
            with urllib.request.urlopen(url, timeout=5) as resp:
                token_data = _json.loads(resp.read().decode())
        except Exception:
            return Response({'error': 'Token doğrulaması başarısız'}, status=status.HTTP_401_UNAUTHORIZED)

        email = (token_data.get('email') or '').strip().lower()
        if not email or not any(email.endswith(d) for d in _IUC_DOMAINS):
            return Response({'error': 'IÜC e-posta adresi gerekli'}, status=status.HTTP_403_FORBIDDEN)

        try:
            user = Student.objects.get(iuc_email=email)
        except Student.DoesNotExist:
            return Response(
                {'error': 'Kullanıcı bulunamadı. Önce giriş sayfasını ziyaret edin.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        refresh = RefreshToken.for_user(user)
        return Response({'access': str(refresh.access_token), 'refresh': str(refresh)})
