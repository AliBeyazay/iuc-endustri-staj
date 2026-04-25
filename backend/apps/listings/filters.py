import django_filters

from .models import Listing


class CharInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    """?source_platform=linkedin&source_platform=kariyer → IN lookup, serbest metin."""
    pass


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
    source_platform  = CharInFilter(field_name='source_platform', lookup_expr='in')
    is_talent_program = django_filters.BooleanFilter()
    deadline_status  = django_filters.MultipleChoiceFilter(
        choices=Listing._meta.get_field('deadline_status').choices
    )

    class Meta:
        model  = Listing
        fields = [
            'em_focus_area', 'internship_type', 'company_origin',
            'source_platform', 'is_talent_program', 'deadline_status',
        ]
