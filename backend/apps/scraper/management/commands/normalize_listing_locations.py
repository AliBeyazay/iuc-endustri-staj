from django.core.management.base import BaseCommand
from django.db.models import Count

from apps.listings.models import Listing
from apps.scraper.spiders.base_spider import BaseEMSpider


class Command(BaseCommand):
    help = 'Re-normalizes location field on all canonical listings to canonical city values.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--batch-size', type=int, default=500)

    def handle(self, *args, **options):
        spider = BaseEMSpider()
        dry_run = options['dry_run']
        batch_size = options['batch_size']

        qs = Listing.objects.filter(canonical_listing__isnull=True)
        total = qs.count()
        self.stdout.write(f'Processing {total} listings...')

        changed = 0
        to_update = []

        for listing in qs.iterator(chunk_size=batch_size):
            new_loc = spider.normalize_location(listing.location or '')
            if new_loc != listing.location:
                listing.location = new_loc
                to_update.append(listing)
                changed += 1

        if not dry_run and to_update:
            Listing.objects.bulk_update(to_update, ['location'], batch_size=batch_size)

        suffix = ' (dry run)' if dry_run else ''
        self.stdout.write(f'Updated {changed}/{total} listings{suffix}')

        dist = qs.values('location').annotate(n=Count('id')).order_by('-n')
        self.stdout.write('\nLocation distribution:')
        for row in dist:
            pct = row['n'] / total * 100
            self.stdout.write(f"  {row['location']:<20} {row['n']:5d}  {pct:5.1f}%")
