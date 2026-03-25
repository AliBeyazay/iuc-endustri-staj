import re

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.exceptions import AuthenticationFailed

from .models import Bookmark, Listing, Review, Student


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
            'em_focus_area', 'secondary_em_focus_area', 'em_focus_confidence',
            'internship_type', 'company_origin',
            'location', 'description', 'requirements',
            'application_deadline', 'deadline_status',
            'is_active', 'is_talent_program', 'program_type', 'duration_weeks',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['company_name'] = clean_company_name(data.get('company_name', ''))
        return data


class ListingListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Listing
        fields = [
            'id', 'title', 'company_name', 'company_logo_url',
            'source_url', 'application_url', 'source_platform', 'em_focus_area',
            'secondary_em_focus_area', 'em_focus_confidence', 'internship_type',
            'company_origin', 'location',
            'application_deadline', 'deadline_status',
            'is_active', 'is_talent_program', 'program_type', 'duration_weeks',
            'created_at',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['company_name'] = clean_company_name(data.get('company_name', ''))
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
            raise serializers.ValidationError('Puan 1-5 arasinda olmali.')
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


class StudentProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    completion_percentage = serializers.ReadOnlyField()
    missing_fields = serializers.ReadOnlyField()

    class Meta:
        model = Student
        fields = [
            'id', 'full_name', 'iuc_email', 'student_no',
            'department_year', 'linkedin_url', 'cv_url',
            'avatar_url', 'is_verified',
            'completion_percentage', 'missing_fields',
        ]
        read_only_fields = [
            'id', 'iuc_email', 'is_verified',
            'completion_percentage', 'missing_fields',
        ]

    def get_full_name(self, obj):
        return f'{obj.first_name} {obj.last_name}'.strip()


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
            raise serializers.ValidationError('Bu e-posta zaten kayitli.')
        return value

    def validate_student_no(self, value):
        existing_student = Student.objects.filter(student_no=value).first()
        if existing_student and existing_student.is_verified:
            raise serializers.ValidationError('Bu ogrenci numarasi zaten kayitli.')
        return value


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = Student.USERNAME_FIELD

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['email'] = serializers.EmailField()
        self.fields['password'] = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = (attrs.get('email') or '').strip().lower()
        credentials = {
            Student.USERNAME_FIELD: email,
            'password': attrs.get('password'),
        }
        data = super().validate(credentials)
        if not self.user.is_verified:
            raise AuthenticationFailed('E-posta adresi henuz dogrulanmadi.')
        data['user'] = {
            'id': str(self.user.id),
            'full_name': f'{self.user.first_name} {self.user.last_name}'.strip(),
            'iuc_email': self.user.iuc_email,
            'student_no': self.user.student_no,
            'is_verified': self.user.is_verified,
            'department_year': self.user.department_year,
            'avatar_url': self.user.avatar_url,
        }
        return data
