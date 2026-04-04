import re
from urllib.parse import urlparse

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.exceptions import AuthenticationFailed

from .models import (
    APPLICATION_STATUS_CHOICES,
    Application,
    Bookmark,
    EM_FOCUS_CHOICES,
    InternshipJournal,
    JournalComment,
    Listing,
    Review,
    Student,
)


# Well-known company domain mappings
_KNOWN_DOMAINS = {
    # Tech / Social Media
    'tiktok': 'tiktok.com',
    'google': 'google.com',
    'microsoft': 'microsoft.com',
    'meta': 'meta.com',
    'apple': 'apple.com',
    'amazon': 'amazon.com.tr',
    'huawei': 'huawei.com',
    'samsung': 'samsung.com',
    'nvidia': 'nvidia.com',
    'oracle': 'oracle.com',
    'sap': 'sap.com',
    'ibm': 'ibm.com',
    'cisco': 'cisco.com',
    'adobe': 'adobe.com',
    'spotify': 'spotify.com',
    'trendyol': 'trendyol.com',
    'hepsiburada': 'hepsiburada.com',
    'getir': 'getir.com',
    'n11': 'n11.com',
    'sahibinden': 'sahibinden.com',
    'yemeksepeti': 'yemeksepeti.com',
    # Telco
    'turkcell': 'turkcell.com.tr',
    'türk telekom': 'turktelekom.com.tr',
    'vodafone': 'vodafone.com.tr',
    # Automotive
    'mercedes-benz': 'mercedes-benz.com.tr',
    'mercedes': 'mercedes-benz.com.tr',
    'ford': 'ford.com.tr',
    'toyota': 'toyota.com.tr',
    'bmw': 'bmw.com.tr',
    'volkswagen': 'volkswagen.com.tr',
    'hyundai': 'hyundai.com.tr',
    'renault': 'renault.com.tr',
    'fiat': 'fiat.com.tr',
    'honda': 'honda.com.tr',
    'tofaş': 'tofas.com.tr',
    # Industry / Manufacturing
    'bosch': 'bosch.com.tr',
    'siemens': 'siemens.com.tr',
    'arçelik': 'arcelik.com.tr',
    'vestel': 'vestel.com.tr',
    'schneider': 'se.com',
    'abb': 'abb.com',
    # Holdings
    'koç': 'koc.com.tr',
    'sabancı': 'sabanci.com',
    'doğuş': 'dogus.com.tr',
    'zorlu': 'zorlu.com',
    # Defence / Aerospace
    'aselsan': 'aselsan.com.tr',
    'havelsan': 'havelsan.com.tr',
    'tusaş': 'tusas.com',
    'roketsan': 'roketsan.com.tr',
    'baykar': 'baykartech.com',
    # Banking / Finance
    'akbank': 'akbank.com',
    'garanti': 'garantibbva.com.tr',
    'yapı kredi': 'yapikredi.com.tr',
    'iş bankası': 'isbank.com.tr',
    'ziraat': 'ziraatbank.com.tr',
    'halkbank': 'halkbank.com.tr',
    'qnb finansbank': 'qnb.com.tr',
    'denizbank': 'denizbank.com',
    'vakıfbank': 'vakifbank.com.tr',
    # Energy
    'tüpraş': 'tupras.com.tr',
    'petkim': 'petkim.com.tr',
    'enerjisa': 'enerjisa.com.tr',
    'socar': 'socar.com.tr',
    # FMCG / Food
    'unilever': 'unilever.com.tr',
    'nestlé': 'nestle.com.tr',
    'nestle': 'nestle.com.tr',
    'coca-cola': 'coca-cola.com.tr',
    'pepsi': 'pepsico.com.tr',
    'ülker': 'ulker.com.tr',
    # Airlines
    'thy': 'turkishairlines.com',
    'türk hava yolları': 'turkishairlines.com',
    'pegasus': 'flypgs.com',
    # Pharma / Health
    'bayer': 'bayer.com.tr',
    'roche': 'roche.com.tr',
    'novartis': 'novartis.com.tr',
    'pfizer': 'pfizer.com.tr',
    'abdi ibrahim': 'abdiibrahim.com.tr',
    # Consulting
    'deloitte': 'deloitte.com',
    'pwc': 'pwc.com.tr',
    'kpmg': 'kpmg.com.tr',
    'ey': 'ey.com',
    # Retail
    'lc waikiki': 'lcwaikiki.com',
    'lcw': 'lcwaikiki.com',
    'watsons': 'watsons.com.tr',
    'beymen': 'beymen.com',
    'defacto': 'defacto.com.tr',
    'koton': 'koton.com',
    'mavi': 'mavi.com',
    'migros': 'migros.com.tr',
    # Misc
    'commencis': 'commencis.com',
    'sestek': 'sestek.com',
    'phinia': 'phinia.com',
    'kızılay': 'kizilay.org.tr',
    'kızılay teknoloji': 'kizilaykariyer.com',
    'coral travel': 'coraltravel.com.tr',
}

_JOB_BOARDS = (
    'linkedin.com', 'kariyer.net', 'youthall.com', 'indeed.com',
    'glassdoor.com', 'anbea.co', 'toptalent.co', 'savunmakariyer.com',
    'boomerangkariyergunleri.com',
)


def _get_logo_fallback(company_name, application_url):
    """Generate a fallback logo URL using Google Favicons."""
    name_lower = (company_name or '').lower().strip()
    domain = None

    # Try known domains first
    for key, d in _KNOWN_DOMAINS.items():
        if key in name_lower:
            domain = d
            break

    # Try application URL domain
    if not domain and application_url:
        try:
            parsed = urlparse(application_url)
            d = parsed.netloc or ''
            if d.startswith('www.'):
                d = d[4:]
            if '.' in d and not any(jb in d for jb in _JOB_BOARDS):
                domain = d
        except Exception:
            pass

    if domain:
        return f'https://www.google.com/s2/favicons?domain={domain}&sz=128'
    return None


def clean_company_name(name: str) -> str:
    """Strip scraping artifacts from company_name."""
    if not name:
        return name
    # Remove common metadata patterns scraped from job pages
    patterns = [
        r'Şehir/City\s*[^İı]*',           # "Şehir/City İstanbul(Avr.) ..."
        r'İlan Bilgileri/?Job Announcement Info',
        r'Firma Adı/?Company Name',
        r'Sektör/?Sector[^\s]*',
        r'Çalışan Sayısı/?Number of Employees[^\s]*',
    ]
    for pat in patterns:
        name = re.sub(pat, '', name, flags=re.IGNORECASE).strip()
    # Collapse multiple spaces
    name = re.sub(r'\s{2,}', ' ', name).strip()
    # If the remaining name is duplicated (e.g. "TEB A.Ş. TEB A.Ş."), deduplicate
    half = len(name) // 2
    if half > 3 and name[:half].strip() == name[half:].strip():
        name = name[:half].strip()
    return name


class ListingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Listing
        fields = [
            'id', 'title', 'company_name', 'company_logo_url',
            'source_url', 'application_url', 'source_platform',
            'canonical_listing',
            'em_focus_area', 'secondary_em_focus_area', 'em_focus_confidence',
            'internship_type', 'company_origin',
            'location', 'description', 'requirements',
            'application_deadline', 'deadline_status',
            'is_active', 'is_talent_program', 'program_type', 'duration_weeks',
            'moderation_status', 'moderation_note', 'moderated_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['company_name'] = clean_company_name(data.get('company_name', ''))
        if not data.get('company_logo_url'):
            data['company_logo_url'] = _get_logo_fallback(
                data.get('company_name', ''),
                data.get('application_url', ''),
            )
        return data


class ListingListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Listing
        fields = [
            'id', 'title', 'company_name', 'company_logo_url',
            'source_url', 'application_url', 'source_platform', 'canonical_listing', 'em_focus_area',
            'secondary_em_focus_area', 'em_focus_confidence', 'internship_type',
            'company_origin', 'location',
            'application_deadline', 'deadline_status',
            'is_active', 'is_talent_program', 'program_type', 'duration_weeks',
            'moderation_status',
            'created_at',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['company_name'] = clean_company_name(data.get('company_name', ''))
        if not data.get('company_logo_url'):
            data['company_logo_url'] = _get_logo_fallback(
                data.get('company_name', ''),
                data.get('application_url', ''),
            )
        return data


class ReviewSerializer(serializers.ModelSerializer):
    student = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Review
        fields = [
            'id', 'listing', 'student', 'rating', 'comment',
            'internship_year', 'is_anonymous', 'created_at',
        ]
        read_only_fields = ['id', 'student', 'created_at']

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError('Puan 1-5 arasında olmalı.')
        return value

    def create(self, validated_data):
        validated_data['student'] = self.context['request'].user
        return super().create(validated_data)


class BookmarkSerializer(serializers.ModelSerializer):
    listing = ListingSerializer(read_only=True)
    listing_id = serializers.UUIDField(write_only=True)
    bookmarked_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Bookmark
        fields = ['id', 'listing', 'listing_id', 'bookmarked_at']
        read_only_fields = ['id', 'bookmarked_at']

    def create(self, validated_data):
        validated_data['student'] = self.context['request'].user
        listing_id = validated_data.pop('listing_id')
        listing = Listing.objects.get(id=listing_id)
        return Bookmark.objects.get_or_create(
            student=validated_data['student'],
            listing=listing,
        )[0]


class JournalCommentListSerializer(serializers.ModelSerializer):
    student_display_name = serializers.SerializerMethodField()

    class Meta:
        model = JournalComment
        fields = ['id', 'journal', 'content', 'is_anonymous', 'created_at', 'student_display_name']
        read_only_fields = ['id', 'created_at', 'student_display_name']

    def get_student_display_name(self, obj):
        if obj.is_anonymous:
            return 'Anonim Öğrenci'
        full_name = f'{obj.student.first_name} {obj.student.last_name}'.strip()
        return full_name or obj.student.iuc_email


class JournalCommentWriteSerializer(serializers.ModelSerializer):
    journal_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = JournalComment
        fields = ['id', 'journal_id', 'content', 'is_anonymous', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_content(self, value):
        clean = value.strip()
        if len(clean) < 2:
            raise serializers.ValidationError('Yorum en az 2 karakter olmalı.')
        return clean

    def create(self, validated_data):
        student = self.context['request'].user
        journal_id = validated_data.pop('journal_id')
        journal = InternshipJournal.objects.get(id=journal_id)
        return JournalComment.objects.create(
            student=student,
            journal=journal,
            **validated_data,
        )


class InternshipJournalListSerializer(serializers.ModelSerializer):
    student_display_name = serializers.SerializerMethodField()
    listing_title = serializers.CharField(source='listing.title', read_only=True)
    listing_id = serializers.UUIDField(source='listing.id', read_only=True)
    comments = JournalCommentListSerializer(many=True, read_only=True)
    comments_count = serializers.IntegerField(source='comments.count', read_only=True)

    class Meta:
        model = InternshipJournal
        fields = [
            'id', 'title', 'content', 'internship_year', 'is_anonymous',
            'likes_count', 'created_at', 'updated_at',
            'student_display_name', 'listing_title', 'listing_id',
            'comments_count', 'comments',
        ]
        read_only_fields = [
            'id', 'likes_count', 'created_at', 'updated_at',
            'student_display_name', 'listing_title', 'listing_id',
        ]

    def get_student_display_name(self, obj):
        if obj.is_anonymous:
            return 'Anonim Öğrenci'
        full_name = f'{obj.student.first_name} {obj.student.last_name}'.strip()
        return full_name or obj.student.iuc_email


class InternshipJournalWriteSerializer(serializers.ModelSerializer):
    listing_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = InternshipJournal
        fields = [
            'id', 'listing_id', 'title', 'content',
            'internship_year', 'is_anonymous', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_title(self, value):
        if len(value.strip()) < 8:
            raise serializers.ValidationError('Başlık en az 8 karakter olmalı.')
        return value.strip()

    def validate_content(self, value):
        clean = value.strip()
        if len(clean) < 120:
            raise serializers.ValidationError('İçerik en az 120 karakter olmalı.')
        return clean

    def create(self, validated_data):
        student = self.context['request'].user
        listing_id = validated_data.pop('listing_id', None)
        listing = None
        if listing_id:
            listing = Listing.objects.filter(id=listing_id).first()
        return InternshipJournal.objects.create(
            student=student,
            listing=listing,
            **validated_data,
        )


class ApplicationListSerializer(serializers.ModelSerializer):
    listing = ListingListSerializer(read_only=True)

    class Meta:
        model = Application
        fields = ['id', 'listing', 'status', 'applied_at', 'notes']
        read_only_fields = ['id', 'applied_at']


class ApplicationWriteSerializer(serializers.ModelSerializer):
    listing_id = serializers.UUIDField(write_only=True, required=False)
    status = serializers.ChoiceField(choices=[c[0] for c in APPLICATION_STATUS_CHOICES], required=False)

    class Meta:
        model = Application
        fields = ['id', 'listing_id', 'status', 'notes', 'applied_at']
        read_only_fields = ['id', 'applied_at']

    def validate(self, attrs):
        if self.instance is None and not attrs.get('listing_id'):
            raise serializers.ValidationError({'listing_id': 'Bu alan zorunlu.'})
        return attrs

    def create(self, validated_data):
        student = self.context['request'].user
        listing_id = validated_data.pop('listing_id')
        listing = Listing.objects.get(id=listing_id)
        defaults = {
            'status': validated_data.get('status', 'basvurdum'),
            'notes': validated_data.get('notes', ''),
        }
        application, _ = Application.objects.update_or_create(
            student=student,
            listing=listing,
            defaults=defaults,
        )
        return application


class StudentProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    completion_percentage = serializers.ReadOnlyField()
    missing_fields = serializers.ReadOnlyField()

    class Meta:
        model = Student
        fields = [
            'id', 'full_name', 'iuc_email', 'student_no',
            'department_year', 'linkedin_url', 'cv_url',
            'avatar_url', 'is_verified', 'is_staff',
            'completion_percentage', 'missing_fields',
            'notification_preferences',
        ]
        read_only_fields = [
            'id', 'iuc_email', 'is_verified', 'is_staff',
            'completion_percentage', 'missing_fields',
        ]

    def get_full_name(self, obj):
        return f'{obj.first_name} {obj.last_name}'.strip()


class NotificationPreferencesSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(default=False)
    sectors = serializers.ListField(
        child=serializers.ChoiceField(choices=[c[0] for c in EM_FOCUS_CHOICES]),
        required=False, default=list,
    )
    locations = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False, default=list,
    )


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    student_no = serializers.CharField(max_length=10)
    department_year = serializers.IntegerField(min_value=1, max_value=4)
    linkedin_url = serializers.URLField(required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.strip().lower()
        if not (value.endswith('@ogr.iuc.edu.tr') or value.endswith('@iuc.edu.tr')):
            raise serializers.ValidationError(
                'Sadece @ogr.iuc.edu.tr veya @iuc.edu.tr adresleri kabul edilir.'
            )
        existing_student = Student.objects.filter(iuc_email__iexact=value).first()
        if existing_student and existing_student.is_verified:
            raise serializers.ValidationError('Bu e-posta zaten kayıtlı.')
        return value

    def validate_student_no(self, value):
        existing_student = Student.objects.filter(student_no=value).first()
        if existing_student and existing_student.is_verified:
            raise serializers.ValidationError('Bu öğrenci numarası zaten kayıtlı.')
        return value


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = Student.USERNAME_FIELD

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['email'] = serializers.EmailField()
        self.fields['password'] = serializers.CharField(write_only=True)
        # Remove the auto-generated iuc_email field from SimpleJWT;
        # we map email -> iuc_email in validate() instead.
        self.fields.pop('iuc_email', None)

    def validate(self, attrs):
        email = (attrs.get('email') or '').strip().lower()
        credentials = {
            Student.USERNAME_FIELD: email,
            'password': attrs.get('password'),
        }
        data = super().validate(credentials)
        if not self.user.is_verified:
            raise AuthenticationFailed('E-posta adresi henüz doğrulanmadı.')
        data['user'] = {
            'id': str(self.user.id),
            'full_name': f'{self.user.first_name} {self.user.last_name}'.strip(),
            'iuc_email': self.user.iuc_email,
            'student_no': self.user.student_no,
            'is_verified': self.user.is_verified,
            'is_staff': self.user.is_staff,
            'department_year': self.user.department_year,
            'avatar_url': self.user.avatar_url,
        }
        return data


class AdminListingListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Listing
        fields = [
            'id',
            'title',
            'company_name',
            'source_platform',
            'location',
            'application_deadline',
            'deadline_status',
            'is_active',
            'moderation_status',
            'moderation_note',
            'moderated_at',
            'created_at',
            'updated_at',
        ]


class AdminListingUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Listing
        fields = [
            'title',
            'company_name',
            'location',
            'description',
            'requirements',
            'application_deadline',
            'application_url',
            'source_url',
            'is_active',
            'moderation_status',
            'moderation_note',
        ]
