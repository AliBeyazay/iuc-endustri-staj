"""Delete listings by ID or title match. Usage: manage.py delete_listing --id <uuid> | --title <substring> | --company <substring>"""
import unicodedata

from django.core.management.base import BaseCommand

from apps.listings.models import Listing
from apps.listings.sync import delete_listing_groups


def _normalize(text: str) -> str:
    """Strip accents and lowercase for accent-insensitive matching."""
    return ''.join(
        c for c in unicodedata.normalize('NFD', text.lower()) if unicodedata.category(c) != 'Mn'
    )


class Command(BaseCommand):
    help = 'Delete listing(s) by ID, title substring, or company name'

    def add_arguments(self, parser):
        parser.add_argument('--id', type=str, help='Listing UUID to delete')
        parser.add_argument('--title', type=str, help='Title substring to match (accent-insensitive)')
        parser.add_argument('--company', type=str, help='Company name substring to match (accent-insensitive)')

    def handle(self, *args, **options):
        if options['id']:
            qs = Listing.objects.filter(id=options['id'])
        elif options['title'] or options['company']:
            # Accent-insensitive: normalize and scan in Python
            needle_title = _normalize(options['title']) if options['title'] else None
            needle_company = _normalize(options['company']) if options['company'] else None
            ids_to_delete = []
            for listing in Listing.objects.all().only('id', 'title', 'company_name'):
                if needle_title and needle_title not in _normalize(listing.title):
                    continue
                if needle_company and needle_company not in _normalize(listing.company_name):
                    continue
                ids_to_delete.append(listing.id)
            qs = Listing.objects.filter(id__in=ids_to_delete)
        else:
            self.stderr.write('Provide --id, --title, or --company')
            return

        count = qs.count()
        if count == 0:
            self.stdout.write('No matching listings found.')
            return

        for listing in qs:
            self.stdout.write(f'  Deleting: {listing.title} ({listing.company_name}) [{listing.id}]')
        deleted_count = delete_listing_groups(qs)
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted_count} listing(s).'))
