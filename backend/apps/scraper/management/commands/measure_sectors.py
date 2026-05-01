from django.core.management.base import BaseCommand
from django.db.models import Avg, Count, Q

from apps.listings.models import Listing


class Command(BaseCommand):
    help = 'Print EM sector distribution and confidence stats for active canonical listings.'

    def add_arguments(self, parser):
        parser.add_argument('--focus-area', type=str, default='diger')
        parser.add_argument('--sample-size', type=int, default=20)

    def handle(self, *args, **options):
        focus_area = options['focus_area']
        sample_size = max(0, options['sample_size'])

        qs = Listing.objects.filter(is_active=True, canonical_listing__isnull=True)
        total = qs.count()

        self.stdout.write(f'Toplam aktif kanonik ilan: {total}')
        self.stdout.write('')

        if total:
            dist = qs.values('em_focus_area').annotate(n=Count('id')).order_by('-n')
            for row in dist:
                pct = row['n'] / total * 100
                bar = '#' * int(pct / 2)
                self.stdout.write(
                    f"{row['em_focus_area']:<35} {row['n']:5d}  {pct:5.1f}%  {bar}"
                )

        stats = qs.aggregate(
            avg_conf=Avg('em_focus_confidence'),
            zero_conf=Count('id', filter=Q(em_focus_confidence=0)),
            low_conf=Count('id', filter=Q(em_focus_confidence__lt=35)),
        )
        self.stdout.write('')
        self.stdout.write(f"Ort. confidence : {round(float(stats['avg_conf'] or 0), 1)} %")
        self.stdout.write(f"Confidence=0    : {stats['zero_conf']} ilan")
        self.stdout.write(f"Confidence<35   : {stats['low_conf']} ilan")

        if sample_size == 0:
            return

        self.stdout.write(f"\n--- '{focus_area}' sinifindaki {sample_size} ornek ilan ---")
        listings = qs.filter(em_focus_area=focus_area).order_by('-created_at')[:sample_size]
        for listing in listings:
            conf = float(listing.em_focus_confidence or 0)
            self.stdout.write(
                f"  [{conf:5.1f}%] {listing.source_platform} | {listing.title[:80]}"
            )
