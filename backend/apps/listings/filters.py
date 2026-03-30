import django_filters
from django.db.models import Q
from .models import Listing


class ListingFilter(django_filters.FilterSet):
    em_focus_area    = django_filters.MultipleChoiceFilter(
        choices=Listing._meta.get_field('em_focus_area').choices
    )
    internship_type  = django_filters.MultipleChoiceFilter(
        choices=Listing._meta.get_field('internship_type').choices
    )
    company_origin   = django_filters.MultipleChoiceFilter(
        choices=Listing._meta.get_field('company_origin').choices
    )
    source_platform  = django_filters.MultipleChoiceFilter(
        choices=Listing._meta.get_field('source_platform').choices
    )
    is_talent_program = django_filters.BooleanFilter()
    deadline_status  = django_filters.MultipleChoiceFilter(
        choices=Listing._meta.get_field('deadline_status').choices
    )
    duration_bucket = django_filters.MultipleChoiceFilter(
        choices=[
            ('4_weeks', '4 hafta'),
            ('8_weeks', '8 hafta'),
            ('12_plus_weeks', '12+ hafta'),
        ],
        method='filter_duration_bucket',
    )

    def filter_duration_bucket(self, queryset, name, value):
        if not value:
            return queryset

        condition = Q()
        if '4_weeks' in value:
            condition |= Q(duration_weeks__isnull=False, duration_weeks__lte=4)
        if '8_weeks' in value:
            condition |= Q(duration_weeks__isnull=False, duration_weeks__gt=4, duration_weeks__lte=8)
        if '12_plus_weeks' in value:
            condition |= Q(duration_weeks__isnull=False, duration_weeks__gte=12)

        if not condition:
            return queryset
        return queryset.filter(condition)

    class Meta:
        model  = Listing
        fields = [
            'em_focus_area', 'internship_type', 'company_origin',
            'source_platform', 'is_talent_program', 'deadline_status', 'duration_bucket',
        ]
