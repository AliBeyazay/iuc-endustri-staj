"""
Fix Turkish character encoding issues in existing listings.
Marks listings with unrecoverable '?' corruption as inactive,
since the original characters are permanently lost.

Usage:
    python manage.py fix_encoding          # dry-run
    python manage.py fix_encoding --apply  # apply changes
"""
from django.core.management.base import BaseCommand
from apps.listings.models import Listing


class Command(BaseCommand):
    help = 'Deactivate listings with corrupted Turkish characters (? in title/company_name)'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Apply changes (default is dry-run)')

    def handle(self, *args, **options):
        apply = options['apply']

        # Find listings where title or company_name contains '?'
        # which indicates lost Turkish characters
        corrupted = Listing.objects.filter(is_active=True).extra(
            where=["title LIKE %s OR company_name LIKE %s"],
            params=['%?%', '%?%'],
        )

        count = corrupted.count()
        self.stdout.write(f'Found {count} listings with corrupted characters')

        if count == 0:
            return

        for listing in corrupted:
            self.stdout.write(
                f'  [{listing.id}] {listing.company_name} — {listing.title}'
            )

        if apply:
            corrupted.update(is_active=False)
            self.stdout.write(self.style.SUCCESS(f'Deactivated {count} corrupted listings'))
        else:
            self.stdout.write(self.style.WARNING('Dry run — use --apply to deactivate these listings'))
