import hashlib
import os
import random
import re
import traceback
from datetime import date, timedelta
from time import time

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.db.models import Avg, Case, Count, FloatField, IntegerField, Q, Value, When
from django.db.models.functions import Coalesce
from django.utils.timezone import now
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import ListingFilter
from .models import Application, Bookmark, InternshipJournal, JournalComment, Listing, Review, Student
from .serializers import (
    ApplicationListSerializer,
    ApplicationWriteSerializer,
    BookmarkSerializer,
    InternshipJournalListSerializer,
    InternshipJournalWriteSerializer,
    JournalCommentListSerializer,
    JournalCommentWriteSerializer,
    ListingListSerializer,
    ListingSerializer,
    NotificationPreferencesSerializer,
    RegisterSerializer,
    ReviewSerializer,
    StudentProfileSerializer,
)

_volatile_cache_store: dict[str, tuple[str, float]] = {}
LISTING_LIST_CACHE_TTL_SECONDS = 30


class ListingViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Listing.objects.filter(is_active=True)
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ListingFilter
    search_fields = ['title', 'company_name', 'description', 'location']
    ordering_fields = [
        'created_at',
        'application_deadline',
        'company_name',
        'em_focus_confidence',
        'bookmark_count',
        'average_rating',
    ]
    ordering = ['-created_at']

    # Endüstri mühendisliğiyle ilgisiz ilanları filtrele
    NEGATIVE_KEYWORDS = [
        'avukat', 'hukuk', 'savcı', 'noter', 'icra',
        'eczacı', 'eczane', 'eczacılık',
        'diş hekimi', 'dişçi', 'diş kliniği',
        'veteriner',
        'kuaför', 'berber', 'güzellik salonu',
        'aşçı', 'aşçıbaşı', 'pastane',
        'muhasebe', 'mali müşavir', 'serbest muhasebeci',
        'hemşire', 'hemşirelik', 'ebe', 'ebelik',
        'odyolog', 'fizyoterapist', 'diyetisyen',
        'psikolog', 'pedagog',
        'sosyal hizmet',
        'gazetecilik', 'muhabir',
        # Yazılım/IT pozisyonları (endüstri müh. değil)
        'backend developer', 'frontend developer', 'front-end developer',
        'full stack developer', 'full-stack developer',
        'fullstack developer', 'software developer', 'software engineer',
        'web developer', 'mobile developer', 'ios developer', 'android developer',
        'devops engineer', 'cloud engineer', 'site reliability',
        'qa engineer', 'test engineer',
        'ui developer', 'ux designer',
        'cyber security', 'siber güvenlik',
        'network engineer', 'ağ uzmanı',
        'database administrator',
        'game developer', 'oyun geliştirici',
        'yazılım geliştirme', 'yazılım test', 'yazılım mühendis',
        'yazılım stajyer', 'test stajyer',
        'bilgisayar mühendis', 'elektronik mühendis',
        'sistem yönetici', 'system admin',
    ]

    def get_serializer_class(self):
        if self.action == 'list':
            return ListingListSerializer
        return ListingSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action in ['list', 'similar']:
            qs = qs.filter(canonical_listing__isnull=True)

        exclude_id = self.request.query_params.get('exclude')
        if exclude_id:
            qs = qs.exclude(id=exclude_id)

        # Süresi geçmiş ilanları gizle
        qs = qs.exclude(deadline_status='expired')
        qs = qs.exclude(application_deadline__lt=date.today())

        # Negatif anahtar kelime filtresi
        neg = Q()
        for kw in self.NEGATIVE_KEYWORDS:
            neg |= Q(title__icontains=kw) | Q(company_name__icontains=kw)
        if neg:
            qs = qs.exclude(neg)

        # Bozuk encoding'li ilanları gizle (? içeren title/company_name)
        qs = qs.exclude(title__contains='?').exclude(company_name__contains='?')

        return qs.annotate(
            bookmark_count=Count('bookmarked_by', distinct=True),
            average_rating=Coalesce(Avg('reviews__rating'), Value(0.0), output_field=FloatField()),
        )

    def list(self, request, *args, **kwargs):
        try:
            cache_key = self._get_list_cache_key(request)
            try:
                cached_payload = cache.get(cache_key)
            except Exception:
                cached_payload = None

            if cached_payload is not None:
                return Response(cached_payload)

            response = super().list(request, *args, **kwargs)
            if response.status_code == status.HTTP_200_OK:
                try:
                    cache.set(cache_key, response.data, timeout=LISTING_LIST_CACHE_TTL_SECONDS)
                except Exception:
                    pass
            return response
        except Exception as exc:
            return Response(
                {
                    'error': str(exc),
                    'type': exc.__class__.__name__,
                    'traceback': traceback.format_exc().splitlines()[-8:],
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _get_list_cache_key(self, request) -> str:
        fingerprint = request.get_full_path()
        digest = hashlib.md5(fingerprint.encode('utf-8')).hexdigest()
        return f'listing-list:v1:{digest}'

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        limit = self.request.query_params.get('limit')
        if limit:
            try:
                return queryset[:int(limit)]
            except (TypeError, ValueError):
                return queryset
        return queryset

    @action(detail=True, methods=['get'])
    def similar(self, request, pk=None):
        listing = self.get_object()
        qs = self.get_queryset().exclude(id=listing.id)

        company = listing.company_name.strip().lower()

        # Extract city from location
        loc = listing.location or ''
        city = re.split(r'[,/()\-]', loc)[0].strip()

        # Title keywords (exclude short / common words)
        _STOP = {
            'staj', 'stajyer', 'stajyeri', 'intern', 'internship',
            'mühendis', 'mühendisi', 'endüstri', 'uzman', 'uzmanı',
            've', 'ile', 'için', 'veya', 'olan', 'olarak',
        }
        title_words = [
            w for w in re.split(r'\s+', listing.title.lower())
            if len(w) > 3 and w not in _STOP
        ][:5]

        # ── Scoring via annotations ──────────────────────────────
        score = Value(0, output_field=IntegerField())

        # Same company  → +10
        score = score + Case(
            When(company_name__iexact=company, then=Value(10)),
            default=Value(0), output_field=IntegerField(),
        )

        # Same primary em_focus_area → +5
        score = score + Case(
            When(em_focus_area=listing.em_focus_area, then=Value(5)),
            default=Value(0), output_field=IntegerField(),
        )

        # Secondary focus cross-match → +3
        if listing.secondary_em_focus_area:
            score = score + Case(
                When(em_focus_area=listing.secondary_em_focus_area, then=Value(3)),
                When(secondary_em_focus_area=listing.em_focus_area, then=Value(3)),
                default=Value(0), output_field=IntegerField(),
            )
        else:
            score = score + Case(
                When(secondary_em_focus_area=listing.em_focus_area, then=Value(3)),
                default=Value(0), output_field=IntegerField(),
            )

        # Same city → +4
        if city and len(city) > 2:
            score = score + Case(
                When(location__icontains=city, then=Value(4)),
                default=Value(0), output_field=IntegerField(),
            )

        # Title keyword overlap → +2 each
        for word in title_words:
            score = score + Case(
                When(title__icontains=word, then=Value(2)),
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
            if any(w in obj.title.lower() for w in title_words):
                reasons.append('title')
            item['match_reasons'] = reasons

        return Response(data)

    @action(detail=True, methods=['get'])
    def reviews(self, request, pk=None):
        listing = self.get_object()
        reviews = listing.reviews.all()
        avg = reviews.aggregate(avg=Avg('rating'))['avg']
        serializer = ReviewSerializer(reviews, many=True)
        return Response({'results': serializer.data, 'average_rating': avg})


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['listing']

    def get_queryset(self):
        return Review.objects.all()

    def get_permissions(self):
        if self.action in ['create', 'destroy']:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def destroy(self, request, *args, **kwargs):
        review = self.get_object()
        if review.student != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class BookmarkViewSet(viewsets.ModelViewSet):
    serializer_class = BookmarkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Bookmark.objects.filter(student=self.request.user).select_related('listing')

    def destroy(self, request, *args, **kwargs):
        listing_id = kwargs.get('pk')
        Bookmark.objects.filter(student=request.user, listing_id=listing_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ApplicationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Application.objects.filter(student=self.request.user).select_related('listing')

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            return ApplicationListSerializer
        return ApplicationWriteSerializer


class InternshipJournalViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['listing']
    search_fields = ['title', 'content']
    ordering_fields = ['created_at', 'updated_at', 'likes_count']
    ordering = ['-created_at']

    def get_queryset(self):
        return InternshipJournal.objects.select_related('student', 'listing').prefetch_related('comments__student')

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            return InternshipJournalListSerializer
        return InternshipJournalWriteSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def perform_update(self, serializer):
        journal = self.get_object()
        if journal.student != self.request.user:
            raise PermissionDenied('Bu yazıyı sadece sahibi güncelleyebilir.')
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        journal = self.get_object()
        if journal.student != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class JournalCommentViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['journal']
    ordering_fields = ['created_at']
    ordering = ['created_at']

    def get_queryset(self):
        return JournalComment.objects.select_related('student', 'journal')

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            return JournalCommentListSerializer
        return JournalCommentWriteSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def perform_update(self, serializer):
        comment = self.get_object()
        if comment.student != self.request.user:
            raise PermissionDenied('Bu yorumu sadece sahibi güncelleyebilir.')
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        if comment.student != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


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
        if not cv_file.name.endswith('.pdf'):
            return Response({'error': 'Sadece PDF yuklenebilir.'}, status=400)

        path = os.path.join(settings.MEDIA_ROOT, 'cvs', f'{request.user.id}.pdf')
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb+') as handle:
            for chunk in cv_file.chunks():
                handle.write(chunk)

        cv_url = f'{settings.MEDIA_URL}cvs/{request.user.id}.pdf'
        request.user.cv_url = cv_url
        request.user.save(update_fields=['cv_url'])
        return Response({'cv_url': cv_url})


class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = date.today()
        return Response({
            'total_active_listings': Listing.objects.filter(is_active=True).count(),
            'bookmarks_count': Bookmark.objects.filter(student=request.user).count(),
            'new_listings_today': Listing.objects.filter(
                is_active=True,
                created_at__date=today,
            ).count(),
            'listings_expiring_soon': Listing.objects.filter(
                is_active=True,
                application_deadline__lte=today + timedelta(days=7),
                application_deadline__gte=today,
            ).count(),
        })


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
            response_data.update({
                'debug_otp': _send_otp(student),
                'delivery_method': 'onscreen',
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

        otp = _send_otp(student)
        response_data = {
            'message': 'Kayıt başarılı. Doğrulama kodu oluşturuldu.',
            'debug_otp': otp,
            'delivery_method': 'onscreen',
        }
        return Response(response_data, status=201)


class VerifyOTPView(APIView):
    permission_classes = [permissions.AllowAny]

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

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        try:
            student = Student.objects.get(iuc_email__iexact=email)
        except Student.DoesNotExist:
            return Response({'error': 'Kullanici bulunamadi.'}, status=404)

        otp = _send_otp(student)
        response_data = {
            'message': 'OTP yeniden olusturuldu.',
            'debug_otp': otp,
            'delivery_method': 'onscreen',
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


def _send_otp(student: Student) -> str:
    otp = str(random.randint(100000, 999999))
    _cache_set(f'otp:{student.iuc_email}', otp, timeout=600)
    return otp


def _verify_otp(student: Student, otp: str) -> bool:
    stored = _cache_get(f'otp:{student.iuc_email}')
    if stored and stored == otp:
        _cache_delete(f'otp:{student.iuc_email}')
        return True
    return False


def _send_password_reset(student: Student):
    token = hashlib.sha256(f'{student.id}{now().timestamp()}'.encode()).hexdigest()
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
    try:
        cache.set(key, value, timeout=timeout)
    except Exception:
        _volatile_cache_store[key] = (value, time() + timeout)


def _cache_get(key: str):
    try:
        return cache.get(key)
    except Exception:
        stored = _volatile_cache_store.get(key)
        if not stored:
            return None
        value, expires_at = stored
        if expires_at <= time():
            _volatile_cache_store.pop(key, None)
            return None
        return value


def _cache_delete(key: str) -> None:
    try:
        cache.delete(key)
    except Exception:
        _volatile_cache_store.pop(key, None)
