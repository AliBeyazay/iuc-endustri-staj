import csv
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.listings.models import Listing
from apps.scraper.spiders.base_spider import BaseEMSpider


class Command(BaseCommand):
    help = 'Exports a CSV file for manual EM sector validation labeling.'

    SECTOR_OPTIONS = (
        'imalat_metal_makine | otomotiv_yan_sanayi | yazilim_bilisim_teknoloji | '
        'hizmet_finans_danismanlik | eticaret_perakende_fmcg | savunma_havacilik_enerji | '
        'gida_kimya_saglik | lojistik_tasimacilik | tekstil_moda | '
        'insaat_yapi_malzemeleri | diger'
    )

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=120)
        parser.add_argument(
            '--output',
            type=str,
            default='backend/validation/em_focus_area_validation.csv',
        )

    def handle(self, *args, **options):
        limit = options['limit']
        output = Path(options['output'])
        output.parent.mkdir(parents=True, exist_ok=True)

        spider = BaseEMSpider()
        listings = Listing.objects.filter(is_active=True).order_by('-created_at')[:limit]

        with output.open('w', newline='', encoding='utf-8-sig') as fh:
            writer = csv.DictWriter(
                fh,
                fieldnames=[
                    'kayit_no',
                    'ilan_basligi',
                    'firma',
                    'kaynak_platform',
                    'tahmin_birincil_sektor',
                    'tahmin_ikincil_sektor',
                    'guven_skoru',
                    'gercek_birincil_sektor',
                    'gercek_ikincil_sektor',
                    'sektor_secenekleri',
                    'kisa_aciklama',
                    'notlar',
                ],
                delimiter=';',
            )
            writer.writeheader()

            for listing in listings:
                classification = spider.get_sector_classification(
                    listing.title,
                    listing.description,
                    listing.company_name,
                    listing.source_platform,
                )
                writer.writerow({
                    'kayit_no': str(listing.id),
                    'ilan_basligi': listing.title,
                    'firma': listing.company_name,
                    'kaynak_platform': listing.source_platform,
                    'tahmin_birincil_sektor': classification['primary'],
                    'tahmin_ikincil_sektor': classification['secondary'] or '',
                    'guven_skoru': classification['confidence'],
                    'gercek_birincil_sektor': '',
                    'gercek_ikincil_sektor': '',
                    'sektor_secenekleri': self.SECTOR_OPTIONS,
                    'kisa_aciklama': (listing.description or '')[:220],
                    'notlar': '',
                })

        self.stdout.write(self.style.SUCCESS(f'Validation dataset exported to {output}'))
