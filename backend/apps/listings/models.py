from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Avg, F
from django.db.models.functions import Greatest
from django.db.models.signals import post_delete, post_save, pre_delete
from django.dispatch import receiver
import uuid

from .sync import invalidate_listing_list_cache, suppress_listing_source
from django.contrib.postgres.search import SearchVectorField
from django.contrib.postgres.indexes import GinIndex


LISTING_CACHE_EXEMPT_UPDATE_FIELDS = frozenset({'moderation_note', 'moderated_at', 'updated_at'})


class Student(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student_no = models.CharField(max_length=10, unique=True, null=True, blank=True)
    iuc_email = models.EmailField(unique=True)
    department_year = models.IntegerField(null=True, blank=True)
    linkedin_url = models.URLField(max_length=500, null=True, blank=True)
    cv_url = models.URLField(max_length=500, null=True, blank=True)
    avatar_url = models.URLField(max_length=500, null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    notification_preferences = models.JSONField(default=dict, blank=True)

    USERNAME_FIELD = 'iuc_email'
    REQUIRED_FIELDS = ['username']

    def clean(self):
        super().clean()
        if self.iuc_email and not (self.iuc_email.endswith('@ogr.iuc.edu.tr') or self.iuc_email.endswith('@iuc.edu.tr')):
            raise ValidationError({'iuc_email': 'Sadece @ogr.iuc.edu.tr veya @iuc.edu.tr uzantılı e-posta adresleri kabul edilmektedir.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def completion_percentage(self) -> int:
        fields = {
            'iuc_email': bool(self.iuc_email),
            'student_no': bool(self.student_no),
            'department_year': bool(self.department_year),
            'linkedin_url': bool(self.linkedin_url),
            'cv_url': bool(self.cv_url),
        }
        done = sum(fields.values())
        total = len(fields)
        return round((done / total) * 100)

    @property
    def missing_fields(self) -> list[str]:
        missing = []
        if not self.student_no:
            missing.append('student_no')
        if not self.linkedin_url:
            missing.append('linkedin')
        if not self.cv_url:
            missing.append('cv')
        return missing

    class Meta:
        verbose_name = 'Öğrenci'
        verbose_name_plural = 'Öğrenciler'


EM_FOCUS_CHOICES = [
    ('imalat_metal_makine', 'Imalat, Metal ve Makine'),
    ('otomotiv_yan_sanayi', 'Otomotiv ve Yan Sanayi'),
    ('yazilim_bilisim_teknoloji', 'Yazilim, Bilisim ve Teknoloji'),
    ('hizmet_finans_danismanlik', 'Hizmet, Finans ve Danismanlik'),
    ('eticaret_perakende_fmcg', 'E-Ticaret, Perakende ve FMCG'),
    ('savunma_havacilik_enerji', 'Savunma, Havacilik ve Enerji'),
    ('gida_kimya_saglik', 'Gida, Kimya ve Saglik'),
    ('lojistik_tasimacilik', 'Lojistik ve Tasimacilik'),
    ('tekstil_moda', 'Tekstil ve Moda'),
    ('insaat_yapi_malzemeleri', 'Insaat ve Yapi Malzemeleri'),
    ('diger', 'Diger'),
]

# SOURCE_PLATFORM_CHOICES kaldırıldı — source_platform artık serbest metin.
# Yeni platform eklemek için sadece scraper spider yazılması yeterli,
# migration veya kod değişikliği gerekmez.

INTERNSHIP_TYPE_CHOICES = [
    ('zorunlu', 'Zorunlu Staj'),
    ('gonullu', 'Gonullu Staj'),
    ('belirsiz', 'Belirsiz'),
]

COMPANY_ORIGIN_CHOICES = [
    ('yerli', 'Yerli'),
    ('yabanci', 'Yabanci'),
    ('belirsiz', 'Belirsiz'),
]

DEADLINE_STATUS_CHOICES = [
    ('urgent', 'Acil (<=7 gun)'),
    ('normal', 'Normal'),
    ('unknown', 'Tarih Belirtilmemis'),
    ('upcoming', 'Yakinda Acilacak'),
    ('expired', 'Suresi Dolmus'),
]

PROGRAM_TYPE_CHOICES = [
    ('yaz_staj_programi', 'Yaz Staj Programi'),
    ('kariyer_baslangic', 'Kariyer Baslangic Programi'),
    ('rotasyon', 'Rotasyon Programi'),
    ('graduate_program', 'Graduate Program'),
    ('akademi_bootcamp', 'Akademi / Bootcamp'),
]

MODERATION_STATUS_CHOICES = [
    ('approved', 'Onaylandi'),
    ('rejected', 'Reddedildi'),
    ('pending', 'Beklemede'),
]


class Listing(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255)
    company_logo_url = models.URLField(max_length=500, null=True, blank=True)
    source_url = models.URLField(max_length=500, unique=True, db_index=True)
    application_url = models.URLField(max_length=500, null=True, blank=True)
    source_platform = models.CharField(max_length=30, db_index=True)
    em_focus_area = models.CharField(max_length=30, choices=EM_FOCUS_CHOICES, default='diger')
    secondary_em_focus_area = models.CharField(max_length=30, choices=EM_FOCUS_CHOICES, null=True, blank=True)
    em_focus_confidence = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    internship_type = models.CharField(max_length=10, choices=INTERNSHIP_TYPE_CHOICES, default='belirsiz')
    company_origin = models.CharField(max_length=10, choices=COMPANY_ORIGIN_CHOICES, default='belirsiz')
    location = models.CharField(max_length=255)
    description = models.TextField()
    requirements = models.TextField(blank=True)
    application_deadline = models.DateField(null=True, blank=True)
    deadline_status = models.CharField(max_length=10, choices=DEADLINE_STATUS_CHOICES, default='unknown')
    is_active = models.BooleanField(default=True, db_index=True)
    is_talent_program = models.BooleanField(default=False, db_index=True)
    program_type = models.CharField(max_length=20, choices=PROGRAM_TYPE_CHOICES, null=True, blank=True)
    duration_weeks = models.IntegerField(null=True, blank=True)
    is_homepage_featured = models.BooleanField(
        default=False,
        db_index=True,
        help_text='Ana sayfadaki "One Cikan Ilanlar" bolumunde goster.',
    )
    homepage_featured_rank = models.PositiveSmallIntegerField(
        default=99,
        help_text='Kucuk sayi once gelir. Ana sayfada en fazla 3 ilan gosterilir.',
    )
    homepage_featured_image_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text='Kartin ust banner gorseli icin harici gorsel URLsi.',
    )
    homepage_featured_summary = models.TextField(
        blank=True,
        default='',
        help_text='Kartta kullanilacak kisa ozet. Bos birakilirsa ilan aciklamasindan otomatik uretilir.',
    )
    moderation_status = models.CharField(
        max_length=10,
        choices=MODERATION_STATUS_CHOICES,
        default='approved',
        db_index=True,
    )
    quality_score = models.SmallIntegerField(
        default=0,
        db_index=True,
        help_text='0-100 arası kalite skoru. (Açıklama uzunluğu, deadline vb. metriklerle)'
    )
    search_vector = SearchVectorField(null=True, blank=True)
    moderation_note = models.TextField(blank=True, default='')
    moderated_at = models.DateTimeField(null=True, blank=True)
    canonical_listing = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='duplicate_listings',
        db_index=True,
    )
    bookmark_count  = models.PositiveIntegerField(
        default=0,
        db_index=True,
        help_text='Denormalize: Bookmark sayısı. post_save/post_delete sinyalleriyle güncellenir.',
    )
    average_rating  = models.FloatField(
        default=0.0,
        db_index=True,
        help_text='Denormalize: Ortalama puan. Review sinyalleriyle güncellenir.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-quality_score', '-created_at']
        verbose_name = 'İlan'
        verbose_name_plural = 'İlanlar'
        indexes = [
            GinIndex(fields=['search_vector']),
        ]

    def calculate_quality_score(self) -> int:
        score = 0
        if self.description and len(self.description) > 200:
            score += 20
        if self.requirements and len(self.requirements.strip()) > 0:
            score += 20
        if self.application_deadline:
            score += 20
        if self.duration_weeks:
            score += 15
        if self.company_logo_url:
            score += 15
        if self.application_url:
            score += 10
        return min(score, 100)

    def save(self, *args, **kwargs):
        # Compute deadline status if not manually set to a special state like 'upcoming'
        # or if application_deadline is provided.
        from apps.listings.deadline_audit import compute_deadline_status
        
        if self.application_deadline:
            self.deadline_status = compute_deadline_status(self.application_deadline)
        elif self.deadline_status != 'upcoming':
            self.deadline_status = 'unknown'
        
        # Auto-deactivate if expired
        if self.deadline_status == 'expired':
            self.is_active = False

        self.quality_score = self.calculate_quality_score()
        super().save(*args, **kwargs)

        # Update search_vector using PostgreSQL functions
        from django.db import connection
        if connection.vendor == 'postgresql':
            from django.contrib.postgres.search import SearchVector
            Listing.objects.filter(pk=self.pk).update(
                search_vector=(
                    SearchVector('title', weight='A') +
                    SearchVector('company_name', weight='A') +
                    SearchVector('location', weight='B') +
                    SearchVector('description', weight='C') +
                    SearchVector('requirements', weight='C')
                )
            )

    def __str__(self):
        return f'{self.title} - {self.company_name}'


class SuppressedListingSource(models.Model):
    source_url = models.URLField(max_length=500, unique=True, db_index=True)
    source_platform = models.CharField(max_length=30, blank=True, default='', db_index=True)
    listing_title = models.CharField(max_length=255, blank=True, default='')
    company_name = models.CharField(max_length=255, blank=True, default='')
    suppressed_reason = models.CharField(max_length=50, default='manual_delete')
    suppressed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-suppressed_at']
        verbose_name = 'Engellenen İlan Kaynağı'
        verbose_name_plural = 'Engellenen İlan Kaynakları'

    def __str__(self):
        return self.source_url


class Review(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='reviews')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='reviews')
    rating = models.IntegerField()
    comment = models.TextField()
    internship_year = models.IntegerField()
    is_anonymous = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = [('listing', 'student')]
        verbose_name = 'Degerlendirme'
        verbose_name_plural = 'Degerlendirmeler'

    def __str__(self):
        return f'{self.listing.company_name} - {self.rating}*'


class Bookmark(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='bookmarks')
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='bookmarked_by')
    bookmarked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('student', 'listing')]
        ordering = ['-bookmarked_at']
        verbose_name = 'Kaydedilen İlan'
        verbose_name_plural = 'Kaydedilen İlanlar'


APPLICATION_STATUS_CHOICES = [
    ('basvurdum', 'Basvurdum'),
    ('mulakat', 'Mulakat'),
    ('kabul', 'Kabul'),
    ('ret', 'Ret'),
]


class Application(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='applications')
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='applications')
    status = models.CharField(max_length=12, choices=APPLICATION_STATUS_CHOICES, default='basvurdum')
    applied_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        unique_together = [('student', 'listing')]
        ordering = ['-applied_at']
        verbose_name = 'Başvuru'
        verbose_name_plural = 'Başvurular'






class ScraperLog(models.Model):
    spider_name = models.CharField(max_length=50)
    started_at = models.DateTimeField()
    finished_at = models.DateTimeField(null=True, blank=True)
    new_count = models.IntegerField(default=0)
    updated_count = models.IntegerField(default=0)
    skipped_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    error_log = models.TextField(blank=True)

    class Meta:
        ordering = ['-started_at']
        verbose_name = 'Scraper Logu'
        verbose_name_plural = 'Scraper Loglari'

    def __str__(self):
        return f'{self.spider_name} - {self.started_at:%Y-%m-%d %H:%M}'


class NegativeKeyword(models.Model):
    keyword = models.CharField(max_length=100, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['keyword']
        verbose_name = 'Negatif Anahtar Kelime'
        verbose_name_plural = 'Negatif Anahtar Kelimeler'

    def __str__(self):
        return self.keyword


class SearchLog(models.Model):
    query = models.CharField(max_length=255)
    result_count = models.IntegerField()
    filters_applied = models.JSONField(default=dict)
    has_results = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Arama Logu'
        verbose_name_plural = 'Arama Loglari'

    def __str__(self):
        return f'"{self.query}" → {self.result_count} sonuç'


@receiver(pre_delete, sender=Listing)
def suppress_listing_source_before_delete(sender, instance, **kwargs):
    suppress_listing_source(instance, reason='manual_delete')


@receiver(post_save, sender=Listing)
def invalidate_listing_cache_after_save(sender, created, update_fields=None, **kwargs):
    if not created and update_fields is not None:
        changed_fields = set(update_fields)
        if not (changed_fields - LISTING_CACHE_EXEMPT_UPDATE_FIELDS):
            return
    invalidate_listing_list_cache()


@receiver(post_delete, sender=Listing)
def invalidate_listing_cache_after_delete(sender, **kwargs):
    invalidate_listing_list_cache()


# ── Bookmark count denorm ——————————————————————————————————

@receiver(post_save, sender='listings.Bookmark')
def update_bookmark_count_on_save(sender, instance, created, **kwargs):
    if created:
        Listing.objects.filter(pk=instance.listing_id).update(
            bookmark_count=Greatest(F('bookmark_count') + 1, 0),
        )


@receiver(post_delete, sender='listings.Bookmark')
def update_bookmark_count_on_delete(sender, instance, **kwargs):
    Listing.objects.filter(pk=instance.listing_id).update(
        bookmark_count=Greatest(F('bookmark_count') - 1, 0),
    )


# ── Average rating denorm —————————————————————————————————

@receiver(post_save, sender='listings.Review')
def update_average_rating_on_save(sender, instance, **kwargs):
    _refresh_average_rating(instance.listing_id)


@receiver(post_delete, sender='listings.Review')
def update_average_rating_on_delete(sender, instance, **kwargs):
    _refresh_average_rating(instance.listing_id)


def _refresh_average_rating(listing_id):
    avg = Review.objects.filter(listing_id=listing_id).aggregate(v=Avg('rating'))['v']
    Listing.objects.filter(pk=listing_id).update(
        average_rating=avg if avg is not None else 0.0,
    )
