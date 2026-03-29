"""
Backfill missing company logos for existing listings.

Usage:
    python manage.py backfill_logos          # dry-run
    python manage.py backfill_logos --apply  # apply changes
"""
import requests as http_requests
from urllib.parse import urlparse

from django.core.management.base import BaseCommand
from apps.listings.models import Listing


KNOWN_DOMAINS = {
    'tiktok': 'tiktok.com',
    'mercedes-benz': 'mercedes-benz.com.tr',
    'mercedes': 'mercedes-benz.com.tr',
    'ford': 'ford.com.tr',
    'toyota': 'toyota.com.tr',
    'bosch': 'bosch.com.tr',
    'siemens': 'siemens.com.tr',
    'arçelik': 'arcelik.com.tr',
    'vestel': 'vestel.com.tr',
    'koç': 'koc.com.tr',
    'sabancı': 'sabanci.com',
    'turkcell': 'turkcell.com.tr',
    'türk telekom': 'turktelekom.com.tr',
    'thy': 'turkishairlines.com',
    'türk hava yolları': 'turkishairlines.com',
    'aselsan': 'aselsan.com.tr',
    'havelsan': 'havelsan.com.tr',
    'tusaş': 'tusas.com',
    'roketsan': 'roketsan.com.tr',
    'baykar': 'baykartech.com',
    'tüpraş': 'tupras.com.tr',
    'petkim': 'petkim.com.tr',
    'enerjisa': 'enerjisa.com.tr',
    'akbank': 'akbank.com',
    'garanti': 'garantibbva.com.tr',
    'yapı kredi': 'yapikredi.com.tr',
    'iş bankası': 'isbank.com.tr',
    'ziraat': 'ziraatbank.com.tr',
    'halkbank': 'halkbank.com.tr',
    'qnb finansbank': 'qnb.com.tr',
    'denizbank': 'denizbank.com',
    'doğuş': 'dogus.com.tr',
    'otokoç': 'otokoc.com.tr',
    'unilever': 'unilever.com.tr',
    'p&g': 'pg.com',
    'procter': 'pg.com',
    'nestlé': 'nestle.com.tr',
    'nestle': 'nestle.com.tr',
    'coca-cola': 'coca-cola.com.tr',
    'pepsi': 'pepsico.com.tr',
    'amazon': 'amazon.com.tr',
    'google': 'google.com',
    'microsoft': 'microsoft.com',
    'meta': 'meta.com',
    'apple': 'apple.com',
    'huawei': 'huawei.com',
    'samsung': 'samsung.com',
    'bmw': 'bmw.com.tr',
    'audi': 'audi.com.tr',
    'volkswagen': 'volkswagen.com.tr',
    'hyundai': 'hyundai.com.tr',
    'renault': 'renault.com.tr',
    'fiat': 'fiat.com.tr',
    'honda': 'honda.com.tr',
    'tofaş': 'tofas.com.tr',
    'coral travel': 'coraltravel.com.tr',
    'beymen': 'beymen.com',
}

JOB_BOARDS = (
    'linkedin.com', 'kariyer.net', 'youthall.com', 'indeed.com',
    'glassdoor.com', 'anbea.co', 'toptalent.co', 'savunmakariyer.com',
    'boomerangkariyergunleri.com',
)


def find_domain(company_name, application_url):
    name_lower = (company_name or '').lower().strip()
    for key, domain in KNOWN_DOMAINS.items():
        if key in name_lower:
            return domain

    if application_url:
        try:
            parsed = urlparse(application_url)
            domain = parsed.netloc or ''
            if domain.startswith('www.'):
                domain = domain[4:]
            if '.' in domain and not any(jb in domain for jb in JOB_BOARDS):
                return domain
        except Exception:
            pass
    return None


def fetch_logo(domain):
    # Google favicon service
    google_url = f'https://www.google.com/s2/favicons?domain={domain}&sz=128'
    try:
        resp = http_requests.head(google_url, timeout=5, allow_redirects=True)
        if resp.status_code == 200:
            content_length = int(resp.headers.get('content-length', 0))
            if content_length > 500:
                return google_url
    except Exception:
        pass

    # Clearbit logo API
    clearbit_url = f'https://logo.clearbit.com/{domain}'
    try:
        resp = http_requests.head(clearbit_url, timeout=5, allow_redirects=True)
        if resp.status_code == 200:
            return clearbit_url
    except Exception:
        pass
    return None


class Command(BaseCommand):
    help = 'Backfill missing company logos for existing listings'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Apply changes')

    def handle(self, *args, **options):
        apply = options['apply']
        no_logo = Listing.objects.filter(
            is_active=True,
            company_logo_url__isnull=True,
        ) | Listing.objects.filter(
            is_active=True,
            company_logo_url='',
        )

        total = no_logo.count()
        self.stdout.write(f'Found {total} listings without logos')

        found = 0
        not_found = 0

        for listing in no_logo:
            domain = find_domain(listing.company_name, listing.application_url)
            if not domain:
                not_found += 1
                continue

            logo_url = fetch_logo(domain)
            if logo_url:
                found += 1
                self.stdout.write(
                    f'  FOUND: {listing.company_name} -> {domain} -> {logo_url}'
                )
                if apply:
                    listing.company_logo_url = logo_url
                    listing.save(update_fields=['company_logo_url'])
            else:
                not_found += 1

        self.stdout.write(f'\nResults: {found} logos found, {not_found} not found')
        if not apply and found:
            self.stdout.write(self.style.WARNING('Dry run — use --apply to save logos'))
