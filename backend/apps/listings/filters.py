import django_filters
from django.db.models import Q
from rest_framework import filters

from .models import Listing


class FuzzySearchFilter(filters.SearchFilter):
    """
    DRF SearchFilter extended with PostgreSQL trigram word similarity so that
    common typos ("samsng", "karier") still return relevant results.

    Trigram matching applies only to `title` and `company_name` — the two
    fields where users are most likely to mis-type a proper noun.
    Falls back silently to plain icontains when pg_trgm is unavailable
    (e.g. SQLite in development).
    """

    def filter_queryset(self, request, queryset, view):
        search_terms = self.get_search_terms(request)
        if not search_terms:
            return queryset

        try:
            return self._fuzzy_filter(queryset, view, search_terms)
        except Exception:
            # pg_trgm not installed or not PostgreSQL — degrade gracefully
            return super().filter_queryset(request, queryset, view)

    def _fuzzy_filter(self, queryset, view, search_terms):
        search_fields = [f.lstrip('^=@$') for f in getattr(view, 'search_fields', [])]

        conditions = Q()
        for term in search_terms:
            # Exact substring match across all configured search fields
            for field in search_fields:
                conditions |= Q(**{f'{field}__icontains': term})
            # Fuzzy word-level match on the two fields users most often mis-type
            conditions |= Q(title__trigram_word_similar=term)
            conditions |= Q(company_name__trigram_word_similar=term)

        return queryset.filter(conditions).distinct()


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
