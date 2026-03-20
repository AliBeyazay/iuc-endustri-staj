from datetime import date, timedelta

from django.core.management.base import BaseCommand

from apps.listings.models import Listing


DEMO_LISTINGS = [
    {
        "title": "Uretim Planlama Stajyeri",
        "company_name": "Arcelik",
        "company_logo_url": "https://upload.wikimedia.org/wikipedia/commons/2/20/Arcelik_logo.svg",
        "source_url": "https://example.com/listings/arcelik-uretim-planlama-stajyeri",
        "source_platform": "linkedin",
        "em_focus_area": "imalat_metal_makine",
        "internship_type": "zorunlu",
        "company_origin": "yerli",
        "location": "Istanbul",
        "description": "Uretim planlama, kapasite analizi ve surec iyilestirme calismalarina destek verecek stajyer araniyor.",
        "requirements": "Endustri Muhendisligi ogrencisi olmak, Excel bilgisi, analitik dusunce.",
        "application_deadline": date.today() + timedelta(days=18),
        "deadline_status": "normal",
        "is_talent_program": False,
    },
    {
        "title": "Supply Chain Intern",
        "company_name": "Unilever",
        "company_logo_url": "https://upload.wikimedia.org/wikipedia/commons/0/07/Unilever_logo.svg",
        "source_url": "https://example.com/listings/unilever-supply-chain-intern",
        "source_platform": "youthall",
        "em_focus_area": "eticaret_perakende_fmcg",
        "internship_type": "gonullu",
        "company_origin": "yabanci",
        "location": "Istanbul Hybrid",
        "description": "Forecast, inventory ve service level metrikleri uzerinde calisacak supply chain intern araniyor.",
        "requirements": "PowerPoint ve Excel bilgisi, iyi seviyede Ingilizce.",
        "application_deadline": date.today() + timedelta(days=12),
        "deadline_status": "normal",
        "is_talent_program": True,
        "program_type": "yaz_staj_programi",
        "duration_weeks": 10,
    },
    {
        "title": "Data Analytics Internship",
        "company_name": "Ford Otosan",
        "company_logo_url": "https://upload.wikimedia.org/wikipedia/commons/3/3e/Ford_logo_flat.svg",
        "source_url": "https://example.com/listings/ford-otosan-data-analytics-internship",
        "source_platform": "linkedin",
        "em_focus_area": "otomotiv_yan_sanayi",
        "internship_type": "zorunlu",
        "company_origin": "yerli",
        "location": "Kocaeli",
        "description": "Operasyonel verilerin analizi ve dashboard olusturma sureclerine destek olacak stajyer araniyor.",
        "requirements": "SQL veya Python bilgisi tercih sebebi.",
        "application_deadline": date.today() + timedelta(days=6),
        "deadline_status": "urgent",
        "is_talent_program": False,
    },
    {
        "title": "Process Improvement Intern",
        "company_name": "Trendyol",
        "company_logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Trendyol_logo.svg/512px-Trendyol_logo.svg.png",
        "source_url": "https://example.com/listings/trendyol-process-improvement-intern",
        "source_platform": "boomerang",
        "em_focus_area": "yazilim_bilisim_teknoloji",
        "internship_type": "gonullu",
        "company_origin": "yerli",
        "location": "Istanbul",
        "description": "Operasyon sureclerini analiz edecek, KPI raporlarina destek verecek stajyer araniyor.",
        "requirements": "Surec yonetimi ve veri analitigi ilgisi.",
        "application_deadline": date.today() + timedelta(days=20),
        "deadline_status": "normal",
        "is_talent_program": True,
        "program_type": "kariyer_baslangic",
        "duration_weeks": 8,
    },
    {
        "title": "Logistics Planning Intern",
        "company_name": "Borusan Lojistik",
        "company_logo_url": "https://www.borusan.com/assets/img/logo.svg",
        "source_url": "https://example.com/listings/borusan-logistics-planning-intern",
        "source_platform": "anbea",
        "em_focus_area": "lojistik_tasimacilik",
        "internship_type": "zorunlu",
        "company_origin": "yerli",
        "location": "Istanbul",
        "description": "Dagitim planlama ve rota optimizasyon ekiplerine destek verecek stajyer araniyor.",
        "requirements": "Analitik dusunme ve ekip calismasina yatkinlik.",
        "application_deadline": date.today() + timedelta(days=9),
        "deadline_status": "normal",
        "is_talent_program": False,
    },
]


class Command(BaseCommand):
    help = "Create demo listings for local development."

    def handle(self, *args, **options):
        created = 0
        updated = 0

        for payload in DEMO_LISTINGS:
            _, was_created = Listing.objects.update_or_create(
                source_url=payload["source_url"],
                defaults=payload,
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo listings ready. created={created} updated={updated} total={Listing.objects.count()}"
            )
        )
