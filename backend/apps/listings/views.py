import hashlib
import logging
import os
import random
import traceback
from datetime import date, timedelta

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.db.models import Avg
from django.utils.timezone import now
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import ListingFilter
from .models import Bookmark, Listing, Review, Student
from .serializers import (
    BookmarkSerializer,
    ListingListSerializer,
    ListingSerializer,
    RegisterSerializer,
    ReviewSerializer,
    StudentProfileSerializer,
)

logger = logging.getLogger(__name__)


class ListingViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Listing.objects.filter(is_active=True)
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ListingFilter
    search_fields = ['title', 'company_name', 'description', 'location']
    ordering_fields = ['created_at', 'application_deadline', 'company_name', 'em_focus_confidence']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return ListingListSerializer
        return ListingSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        exclude_id = self.request.query_params.get('exclude')
        if exclude_id:
            qs = qs.exclude(id=exclude_id)
        return qs

    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except Exception as exc:
            return Response(
                {
                    'error': str(exc),
                    'type': exc.__class__.__name__,
                    'traceback': traceback.format_exc().splitlines()[-8:],
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

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
        if not _is_allowed_iuc_email(email):
            return Response({'exists': False, 'is_verified': False})

        if _is_rate_limited(
            _public_auth_rate_key('account-status', email, request),
            limit=25,
            window_seconds=60,
        ):
            return Response(
                {'error': 'Cok fazla istek gonderildi. Lutfen biraz sonra tekrar deneyin.'},
                status=429,
            )

        try:
            student = Student.objects.get(iuc_email__iexact=email)
        except Student.DoesNotExist:
            return Response({'exists': False, 'is_verified': False})

        return Response({
            'exists': True,
            'is_verified': student.is_verified,
        })


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        names = data['full_name'].split(' ', 1)
        student = Student.objects.filter(iuc_email__iexact=data['email']).first()
        conflicting_student_no = Student.objects.filter(
            student_no=data.get('student_no')
        ).exclude(
            iuc_email__iexact=data['email']
        ).exists()

        if conflicting_student_no:
            return Response({'student_no': ['Bu ogrenci numarasi zaten kayitli.']}, status=400)

        if student and student.is_verified:
            return Response({'email': ['Bu e-posta zaten kayitli.']}, status=400)

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
        response_data = _otp_response_data(otp)
        response_data['message'] = 'Kayit basarili. Dogrulama kodu gonderildi.'
        return Response(response_data, status=201)


class VerifyOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        otp = request.data.get('otp')

        if _is_rate_limited(
            _public_auth_rate_key('verify-otp', email, request),
            limit=10,
            window_seconds=600,
        ):
            return Response(
                {'error': 'Cok fazla dogrulama denemesi yapildi. Lutfen biraz sonra tekrar deneyin.'},
                status=429,
            )

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
        if not _is_allowed_iuc_email(email):
            return Response({'error': 'Gecersiz e-posta adresi.'}, status=400)

        if _is_rate_limited(
            _public_auth_rate_key('resend-otp', email, request),
            limit=5,
            window_seconds=300,
        ):
            return Response(
                {'error': 'Cok fazla kod talebi yapildi. Lutfen biraz sonra tekrar deneyin.'},
                status=429,
            )

        try:
            student = Student.objects.get(iuc_email__iexact=email)
        except Student.DoesNotExist:
            return Response({'error': 'Kullanici bulunamadi.'}, status=404)

        if student.is_verified:
            return Response({'error': 'Bu hesap zaten dogrulanmis.'}, status=400)

        otp = _send_otp(student)
        response_data = _otp_response_data(otp)
        response_data['message'] = 'Dogrulama kodu yeniden gonderildi.'
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
            return Response({'error': 'Gecersiz veya suresi dolmus link.'}, status=400)
        student.set_password(password)
        student.save()
        return Response({'message': 'Sifre guncellendi.'})


def _send_otp(student: Student) -> str:
    otp = str(random.randint(100000, 999999))
    cache.set(f'otp:{student.iuc_email}', otp, timeout=600)
    _send_otp_email(student, otp)
    return otp


def _verify_otp(student: Student, otp: str) -> bool:
    stored = cache.get(f'otp:{student.iuc_email}')
    if stored and stored == otp:
        cache.delete(f'otp:{student.iuc_email}')
        return True
    return False


def _send_password_reset(student: Student):
    token = hashlib.sha256(f'{student.id}{now().timestamp()}'.encode()).hexdigest()
    cache.set(f'reset:{token}', str(student.id), timeout=900)
    reset_url = f'{settings.FRONTEND_URL}/reset-password?token={token}'
    send_mail(
        subject='IUC Staj - Sifre Sifirlama',
        message=f'Sifrenizi sifirlamak icin: {reset_url}\n\nLink 15 dakika gecerlidir.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[student.iuc_email],
    )


def _verify_reset_token(token: str):
    student_id = cache.get(f'reset:{token}')
    if not student_id:
        return None
    cache.delete(f'reset:{token}')
    try:
        return Student.objects.get(id=student_id)
    except Student.DoesNotExist:
        return None


def _send_otp_email(student: Student, otp: str) -> None:
    if not student.iuc_email:
        return
    try:
        send_mail(
            subject='IUC Staj - Dogrulama Kodu',
            message=f'Dogrulama kodunuz: {otp}\n\nKod 10 dakika gecerlidir.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[student.iuc_email],
        )
    except Exception:
        logger.exception('OTP email delivery failed for %s', student.iuc_email)


def _otp_response_data(otp: str) -> dict:
    response_data = {'delivery_method': 'email'}
    if settings.DEBUG or os.getenv('EXPOSE_OTP_ONSCREEN') == '1':
        response_data['debug_otp'] = otp
        response_data['delivery_method'] = 'onscreen'
    return response_data


def _is_allowed_iuc_email(email: str) -> bool:
    return email.endswith('@ogr.iuc.edu.tr') or email.endswith('@iuc.edu.tr')


def _public_auth_rate_key(prefix: str, email: str, request) -> str:
    ip = (request.META.get('HTTP_X_FORWARDED_FOR', '') or '').split(',')[0].strip()
    if not ip:
        ip = request.META.get('REMOTE_ADDR', '') or 'unknown'
    return f'ratelimit:{prefix}:{ip}:{email}'


def _is_rate_limited(key: str, *, limit: int, window_seconds: int) -> bool:
    try:
        current = int(cache.get(key) or 0)
    except (TypeError, ValueError):
        current = 0
    if current >= limit:
        return True
    cache.set(key, current + 1, timeout=window_seconds)
    return False
