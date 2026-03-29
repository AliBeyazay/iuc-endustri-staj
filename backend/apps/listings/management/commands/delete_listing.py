"""Delete listings by ID or title match. Usage: manage.py delete_listing --id <uuid> | --title <substring>"""
from django.core.management.base import BaseCommand
from apps.listings.models import Listing


class Command(BaseCommand):
    help = 'Delete listing(s) by ID or title substring'

    def add_arguments(self, parser):
        parser.add_argument('--id', type=str, help='Listing UUID to delete')
        parser.add_argument('--title', type=str, help='Title substring to match (case-insensitive)')

    def handle(self, *args, **options):
        qs = Listing.objects.all()
        if options['id']:
            qs = qs.filter(id=options['id'])
        elif options['title']:
            qs = qs.filter(title__icontains=options['title'])
        else:
            self.stderr.write('Provide --id or --title')
            return

        count = qs.count()
        if count == 0:
            self.stdout.write('No matching listings found.')
            return

        for listing in qs:
            self.stdout.write(f'  Deleting: {listing.title} ({listing.company_name}) [{listing.id}]')
        qs.delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {count} listing(s).'))
