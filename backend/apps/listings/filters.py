import django_filters
from django.db.models import Q

from .models import Listing


class CharInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    """?source_platform=linkedin&source_platform=kariyer → IN lookup, serbest metin."""
    pass


class ListingFilter(django_filters.FilterSet):
    em_focus_area    = django_filters.MultipleChoiceFilter(
        choices=Listing._meta.get_field('em_focus_area').choices,
        method='filter_em_focus_area',
    )
    internship_type  = django_filters.MultipleChoiceFilter(
        choices=Listing._meta.get_field('internship_type').choices
    )
    company_origin   = django_filters.MultipleChoiceFilter(
        choices=Listing._meta.get_field('company_origin').choices
    )
    source_platform  = CharInFilter(field_name='source_platform', lookup_expr='in')
    location         = CharInFilter(field_name='location', lookup_expr='in')
    is_talent_program = django_filters.BooleanFilter()
    deadline_status  = django_filters.MultipleChoiceFilter(
        choices=Listing._meta.get_field('deadline_status').choices
    )

    class Meta:
        model  = Listing
        fields = [
            'em_focus_area', 'internship_type', 'company_origin',
            'source_platform', 'location', 'is_talent_program', 'deadline_status',
        ]

    def filter_em_focus_area(self, queryset, _name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(em_focus_area__in=value) | Q(secondary_em_focus_area__in=value)
        ).distinct()
