"""
Mevcut ilanlar için bookmark_count ve average_rating alanlarını
geriye dönük olarak hesaplar.

Kullanım:
    python manage.py backfill_listing_counts
    python manage.py backfill_listing_counts --batch-size 500
"""
from django.core.management.base import BaseCommand
from django.db.models import Avg, Count

from apps.listings.models import Listing


class Command(BaseCommand):
    help = 'Listing.bookmark_count ve average_rating alanlarını backfill eder.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--batch-size',
            type=int,
            default=200,
            help='Tek seferde işlenecek ilan sayısı (varsayılan: 200)',
        )

    def handle(self, *args, **options):
        batch_size = options['batch_size']
        total = Listing.objects.count()
        self.stdout.write(f'{total} ilan için backfill başlatılıyor (batch={batch_size})…')

        updated = 0
        qs = (
            Listing.objects
            .annotate(
                _bc=Count('bookmarked_by', distinct=True),
                _ar=Avg('reviews__rating'),
            )
            .only('id')
        )

        batch = []
        for listing in qs.iterator(chunk_size=batch_size):
            listing.bookmark_count = listing._bc
            listing.average_rating = listing._ar if listing._ar is not None else 0.0
            batch.append(listing)

            if len(batch) >= batch_size:
                Listing.objects.bulk_update(batch, ['bookmark_count', 'average_rating'])
                updated += len(batch)
                batch = []
                self.stdout.write(f'  {updated}/{total} güncellendi…')

        if batch:
            Listing.objects.bulk_update(batch, ['bookmark_count', 'average_rating'])
            updated += len(batch)

        self.stdout.write(self.style.SUCCESS(f'Tamamlandı: {updated} ilan güncellendi.'))
