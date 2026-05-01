from django.core.management.base import BaseCommand
from django.db.models import Count

from apps.listings.models import Listing
from apps.scraper.spiders.base_spider import BaseEMSpider


class Command(BaseCommand):
    help = 'Re-runs sector classification on all active canonical listings.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--batch-size', type=int, default=500)

    def handle(self, *args, **options):
        spider = BaseEMSpider()
        dry_run = options['dry_run']
        batch_size = options['batch_size']

        qs = Listing.objects.filter(is_active=True, canonical_listing__isnull=True)
        total = qs.count()
        self.stdout.write(f'Processing {total} listings...')

        changed = 0
        to_update = []

        for listing in qs.iterator(chunk_size=batch_size):
            result = spider.get_sector_classification(
                listing.title,
                listing.description or '',
                listing.company_name or '',
                listing.source_platform or '',
            )
            new_sector = result['primary']
            new_conf = result['confidence']

            if new_sector != listing.em_focus_area or new_conf != float(listing.em_focus_confidence or 0):
                listing.em_focus_area = new_sector
                listing.em_focus_confidence = new_conf
                to_update.append(listing)
                changed += 1

        if not dry_run and to_update:
            Listing.objects.bulk_update(
                to_update,
                ['em_focus_area', 'em_focus_confidence'],
                batch_size=batch_size,
            )

        suffix = ' (dry run)' if dry_run else ''
        self.stdout.write(f'Updated {changed}/{total} listings{suffix}')

        dist = qs.values('em_focus_area').annotate(n=Count('id')).order_by('-n')
        self.stdout.write('\nSector distribution:')
        for row in dist:
            pct = row['n'] / total * 100
            bar = '#' * int(pct / 2)
            self.stdout.write(f"  {row['em_focus_area']:<35} {row['n']:5d}  {pct:5.1f}%  {bar}")
