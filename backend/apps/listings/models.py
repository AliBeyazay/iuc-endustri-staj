from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid


# ─── Users ───────────────────────────────────────────────────────────────────

class Student(AbstractUser):
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student_no    = models.CharField(max_length=10, unique=True, null=True, blank=True)
    iuc_email     = models.EmailField(unique=True)
    department_year = models.IntegerField(null=True, blank=True)
    linkedin_url  = models.URLField(null=True, blank=True)
    cv_url        = models.URLField(null=True, blank=True)
    avatar_url    = models.URLField(null=True, blank=True)
    is_verified   = models.BooleanField(default=False)

    USERNAME_FIELD = 'iuc_email'
    REQUIRED_FIELDS = ['username']

    def validate_iuc_email(self):
        return self.iuc_email.endswith('@ogr.iuc.edu.tr') or \
               self.iuc_email.endswith('@iuc.edu.tr')

    @property
    def completion_percentage(self) -> int:
        fields = {
            'iuc_email':       bool(self.iuc_email),
            'student_no':      bool(self.student_no),
            'department_year': bool(self.department_year),
            'linkedin_url':    bool(self.linkedin_url),
            'cv_url':          bool(self.cv_url),
        }
        done  = sum(fields.values())
        total = len(fields)
        return round((done / total) * 100)

    @property
    def missing_fields(self) -> list[str]:
        missing = []
        if not self.student_no:    missing.append('student_no')
        if not self.linkedin_url:  missing.append('linkedin')
        if not self.cv_url:        missing.append('cv')
        return missing

    class Meta:
        verbose_name = 'Öğrenci'
        verbose_name_plural = 'Öğrenciler'


# ─── Listings ────────────────────────────────────────────────────────────────

EM_FOCUS_CHOICES = [
    ('imalat_metal_makine',       'İmalat, Metal ve Makine'),
    ('otomotiv_yan_sanayi',       'Otomotiv ve Yan Sanayi'),
    ('yazilim_bilisim_teknoloji', 'Yazılım, Bilişim ve Teknoloji'),
    ('hizmet_finans_danismanlik', 'Hizmet, Finans ve Danışmanlık'),
    ('eticaret_perakende_fmcg',   'E-Ticaret, Perakende ve FMCG'),
    ('savunma_havacilik_enerji',  'Savunma, Havacılık ve Enerji'),
    ('gida_kimya_saglik',         'Gıda, Kimya ve Sağlık'),
    ('lojistik_tasimacilık',      'Lojistik ve Taşımacılık'),
    ('tekstil_moda',              'Tekstil ve Moda'),
    ('insaat_yapi_malzemeleri',   'İnşaat ve Yapı Malzemeleri'),
    ('diger',                     'Diğer'),
]

SOURCE_PLATFORM_CHOICES = [
    ('linkedin',  'LinkedIn'),
    ('kariyer',   'Kariyer.net'),
    ('youthall',  'Youthall'),
    ('anbea',     'Anbea Kampüs'),
    ('boomerang', 'Boomerang'),
    ('toptalent', 'TopTalent'),
    ('savunma',   'Savunma Kariyer'),
    ('odtu_kpm',  'ODTU KPM'),
    ('bogazici_km', 'Bogazici Kariyer'),
    ('ytu_orkam', 'YTU ORKAM'),
    ('itu_kariyer', 'ITU Kariyer'),
]

INTERNSHIP_TYPE_CHOICES = [
    ('zorunlu',  'Zorunlu Staj'),
    ('gonullu',  'Gönüllü Staj'),
    ('belirsiz', 'Belirsiz'),
]

COMPANY_ORIGIN_CHOICES = [
    ('yerli',    'Yerli'),
    ('yabanci',  'Yabancı'),
    ('belirsiz', 'Belirsiz'),
]

DEADLINE_STATUS_CHOICES = [
    ('urgent',   'Acil (≤7 gün)'),
    ('normal',   'Normal'),
    ('unknown',  'Tarih Belirtilmemiş'),
    ('upcoming', 'Yakında Açılacak'),
    ('expired',  'Süresi Dolmuş'),
]

PROGRAM_TYPE_CHOICES = [
    ('yaz_staj_programi', 'Yaz Staj Programı'),
    ('kariyer_baslangic', 'Kariyer Başlangıç Programı'),
    ('rotasyon',          'Rotasyon Programı'),
    ('graduate_program',  'Graduate Program'),
    ('akademi_bootcamp',  'Akademi / Bootcamp'),
]


class Listing(models.Model):
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title               = models.CharField(max_length=255)
    company_name        = models.CharField(max_length=255)
    company_logo_url    = models.URLField(null=True, blank=True)
    source_url          = models.URLField(unique=True, db_index=True)
    application_url     = models.URLField(null=True, blank=True)
    source_platform     = models.CharField(max_length=20, choices=SOURCE_PLATFORM_CHOICES)
    em_focus_area       = models.CharField(max_length=30, choices=EM_FOCUS_CHOICES, default='diger')
    secondary_em_focus_area = models.CharField(max_length=30, choices=EM_FOCUS_CHOICES, null=True, blank=True)
    em_focus_confidence = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    internship_type     = models.CharField(max_length=10, choices=INTERNSHIP_TYPE_CHOICES, default='belirsiz')
    company_origin      = models.CharField(max_length=10, choices=COMPANY_ORIGIN_CHOICES, default='belirsiz')
    location            = models.CharField(max_length=255)
    description         = models.TextField()
    requirements        = models.TextField(blank=True)
    application_deadline = models.DateField(null=True, blank=True)
    deadline_status     = models.CharField(max_length=10, choices=DEADLINE_STATUS_CHOICES, default='unknown')
    is_active           = models.BooleanField(default=True, db_index=True)
    is_talent_program   = models.BooleanField(default=False, db_index=True)
    program_type        = models.CharField(max_length=20, choices=PROGRAM_TYPE_CHOICES, null=True, blank=True)
    duration_weeks      = models.IntegerField(null=True, blank=True)
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'İlan'
        verbose_name_plural = 'İlanlar'

    def __str__(self):
        return f'{self.title} — {self.company_name}'


# ─── Reviews ─────────────────────────────────────────────────────────────────

class Review(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    listing         = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='reviews')
    student         = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='reviews')
    rating          = models.IntegerField()  # 1-5
    comment         = models.TextField()
    internship_year = models.IntegerField()
    is_anonymous    = models.BooleanField(default=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = [('listing', 'student')]
        verbose_name = 'Değerlendirme'
        verbose_name_plural = 'Değerlendirmeler'

    def __str__(self):
        return f'{self.listing.company_name} — {self.rating}★'


# ─── Bookmarks ───────────────────────────────────────────────────────────────

class Bookmark(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student      = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='bookmarks')
    listing      = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='bookmarked_by')
    bookmarked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('student', 'listing')]
        ordering = ['-bookmarked_at']
        verbose_name = 'Kaydedilen İlan'
        verbose_name_plural = 'Kaydedilen İlanlar'


# ─── Scraper Log ─────────────────────────────────────────────────────────────

class ScraperLog(models.Model):
    spider_name  = models.CharField(max_length=50)
    started_at   = models.DateTimeField()
    finished_at  = models.DateTimeField(null=True, blank=True)
    new_count    = models.IntegerField(default=0)
    updated_count = models.IntegerField(default=0)
    skipped_count = models.IntegerField(default=0)
    error_count  = models.IntegerField(default=0)
    error_log    = models.TextField(blank=True)

    class Meta:
        ordering = ['-started_at']
        verbose_name = 'Scraper Logu'
        verbose_name_plural = 'Scraper Logları'

    def __str__(self):
        return f'{self.spider_name} — {self.started_at:%Y-%m-%d %H:%M}'
