import os
import re
import unicodedata
from datetime import date
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, urlparse

import requests as http_requests
import django
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from itemadapter import ItemAdapter

# Django setup for ORM access inside Scrapy
BASE_DIR = Path(__file__).resolve().parents[3]
load_dotenv(BASE_DIR / '.env')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
os.environ.setdefault('USE_SQLITE', os.environ.get('USE_SQLITE', 'True'))
# Scrapy 2.13+ runs item pipelines in async-aware context; allow sync ORM calls here.
os.environ.setdefault('DJANGO_ALLOW_ASYNC_UNSAFE', 'true')
django.setup()


# ── Common Turkish-char mojibake repair map ──────────────────────────────────
_MOJIBAKE_MAP = {
    'Ã¼': 'ü', 'Ã¶': 'ö', 'Ã§': 'ç', 'ÅŸ': 'ş', 'Äž': 'Ğ', 'Ä°': 'İ',
    'Ä±': 'ı', 'Ã–': 'Ö', 'Ãœ': 'Ü', 'Ã‡': 'Ç', 'Åž': 'Ş', 'ÄŸ': 'ğ',
    '\x00': '', '\ufffd': '',
}
_MOJIBAKE_RE = re.compile('|'.join(re.escape(k) for k in _MOJIBAKE_MAP))

# Characters that become ? when encoding fails
_TR_CHARS = 'çÇğĞıİöÖşŞüÜ'


def repair_turkish_text(text: str) -> str:
    """Fix common Turkish character encoding issues."""
    if not text:
        return text
    # Fix mojibake sequences
    text = _MOJIBAKE_RE.sub(lambda m: _MOJIBAKE_MAP[m.group()], text)
    # If ? appears where a Turkish char should be, try re-encoding
    if '?' in text:
        for enc in ('latin-1', 'iso-8859-9', 'cp1254'):
            try:
                candidate = text.encode(enc).decode('utf-8')
                if '?' not in candidate or candidate.count('?') < text.count('?'):
                    text = candidate
                    break
            except (UnicodeDecodeError, UnicodeEncodeError):
                continue
    return text


class EncodingRepairPipeline:
    """Repair Turkish character encoding issues in text fields."""

    TEXT_FIELDS = ('title', 'company_name', 'description', 'requirements', 'location')

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        for field in self.TEXT_FIELDS:
            val = adapter.get(field)
            if val and isinstance(val, str):
                adapter[field] = repair_turkish_text(val)
        return item


class CompanyNameCleanPipeline:
    """Strip scraped metadata artifacts from company_name."""

    PATTERNS = [
        r'Şehir/City\s*[^İı]*',
        r'İlan Bilgileri/?Job Announcement Info',
        r'Firma Adı/?Company Name',
        r'Sektör/?Sector[^\s]*',
        r'Çalışan Sayısı/?Number of Employees[^\s]*',
    ]

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        name = adapter.get('company_name', '')
        if name:
            for pat in self.PATTERNS:
                name = re.sub(pat, '', name, flags=re.IGNORECASE).strip()
            name = re.sub(r'\s{2,}', ' ', name).strip()
            half = len(name) // 2
            if half > 3 and name[:half].strip() == name[half:].strip():
                name = name[:half].strip()
            adapter['company_name'] = name
        return item


class LogoEnrichmentPipeline:
    """Find company logo when spider didn't provide one."""

    # Well-known company domain mappings for Turkish companies
    KNOWN_DOMAINS = {
        # Tech / Social Media
        'tiktok': 'tiktok.com',
        'google': 'google.com',
        'microsoft': 'microsoft.com',
        'meta': 'meta.com',
        'apple': 'apple.com',
        'amazon': 'amazon.com.tr',
        'huawei': 'huawei.com',
        'samsung': 'samsung.com',
        'lg': 'lg.com',
        'hp': 'hp.com',
        'dell': 'dell.com',
        'intel': 'intel.com',
        'nvidia': 'nvidia.com',
        'oracle': 'oracle.com',
        'sap': 'sap.com',
        'ibm': 'ibm.com',
        'cisco': 'cisco.com',
        'adobe': 'adobe.com',
        'spotify': 'spotify.com',
        'uber': 'uber.com',
        'airbnb': 'airbnb.com',
        'booking.com': 'booking.com',
        'trendyol': 'trendyol.com',
        'hepsiburada': 'hepsiburada.com',
        'getir': 'getir.com',
        'n11': 'n11.com',
        'sahibinden': 'sahibinden.com',
        'yemeksepeti': 'yemeksepeti.com',
        'pazarama': 'pazarama.com',
        # Telco
        'turkcell': 'turkcell.com.tr',
        'türk telekom': 'turktelekom.com.tr',
        'vodafone': 'vodafone.com.tr',
        # Automotive
        'mercedes-benz': 'mercedes-benz.com.tr',
        'mercedes': 'mercedes-benz.com.tr',
        'ford': 'ford.com.tr',
        'toyota': 'toyota.com.tr',
        'bmw': 'bmw.com.tr',
        'audi': 'audi.com.tr',
        'volkswagen': 'volkswagen.com.tr',
        'hyundai': 'hyundai.com.tr',
        'renault': 'renault.com.tr',
        'fiat': 'fiat.com.tr',
        'honda': 'honda.com.tr',
        'tofaş': 'tofas.com.tr',
        # Industry / Manufacturing
        'bosch': 'bosch.com.tr',
        'siemens': 'siemens.com.tr',
        'arçelik': 'arcelik.com.tr',
        'vestel': 'vestel.com.tr',
        'schneider': 'se.com',
        'abb': 'abb.com',
        # Holdings / Conglomerates
        'koç': 'koc.com.tr',
        'sabancı': 'sabanci.com',
        'doğuş': 'dogus.com.tr',
        'otokoç': 'otokoc.com.tr',
        'zorlu': 'zorlu.com',
        # Defence / Aerospace
        'aselsan': 'aselsan.com.tr',
        'havelsan': 'havelsan.com.tr',
        'tusaş': 'tusas.com',
        'roketsan': 'roketsan.com.tr',
        'baykar': 'baykartech.com',
        # Banking / Finance
        'akbank': 'akbank.com',
        'garanti': 'garantibbva.com.tr',
        'yapı kredi': 'yapikredi.com.tr',
        'iş bankası': 'isbank.com.tr',
        'ziraat': 'ziraatbank.com.tr',
        'halkbank': 'halkbank.com.tr',
        'qnb finansbank': 'qnb.com.tr',
        'denizbank': 'denizbank.com',
        'vakıfbank': 'vakifbank.com.tr',
        'enpara': 'enpara.com',
        # Energy / Petrochemical
        'tüpraş': 'tupras.com.tr',
        'petkim': 'petkim.com.tr',
        'enerjisa': 'enerjisa.com.tr',
        'socar': 'socar.com.tr',
        'shell': 'shell.com.tr',
        'bp': 'bp.com',
        # FMCG / Food
        'unilever': 'unilever.com.tr',
        'p&g': 'pg.com',
        'procter': 'pg.com',
        'nestlé': 'nestle.com.tr',
        'nestle': 'nestle.com.tr',
        'coca-cola': 'coca-cola.com.tr',
        'pepsi': 'pepsico.com.tr',
        'danone': 'danone.com.tr',
        'mondelez': 'mondelezinternational.com',
        'ülker': 'ulker.com.tr',
        'eti': 'etieti.com',
        # Airlines / Logistics
        'thy': 'turkishairlines.com',
        'türk hava yolları': 'turkishairlines.com',
        'pegasus': 'flypgs.com',
        'aras kargo': 'araskargo.com.tr',
        'yurtiçi kargo': 'yurticikargo.com',
        'mng kargo': 'mngkargo.com.tr',
        # Pharma / Health
        'bayer': 'bayer.com.tr',
        'roche': 'roche.com.tr',
        'novartis': 'novartis.com.tr',
        'pfizer': 'pfizer.com.tr',
        'abdi ibrahim': 'abdiibrahim.com.tr',
        'acıbadem': 'acibadem.com.tr',
        'memorial': 'memorial.com.tr',
        # Consulting / Services
        'deloitte': 'deloitte.com',
        'pwc': 'pwc.com.tr',
        'kpmg': 'kpmg.com.tr',
        'ey': 'ey.com',
        'ernst': 'ey.com',
        'mckinsey': 'mckinsey.com',
        'bcg': 'bcg.com',
        # Retail
        'lcw': 'lcwaikiki.com',
        'lc waikiki': 'lcwaikiki.com',
        'watsons': 'watsons.com.tr',
        'beymen': 'beymen.com',
        'defacto': 'defacto.com.tr',
        'koton': 'koton.com',
        'mavi': 'mavi.com',
        'migros': 'migros.com.tr',
        'a101': 'a101.com.tr',
        'bim': 'bim.com.tr',
        'şok': 'sokmarket.com.tr',
        'carrefour': 'carrefoursa.com',
        # Media / Entertainment
        'commencis': 'commencis.com',
        'sestek': 'sestek.com',
        'phinia': 'phinia.com',
        'kızılay': 'kizilay.org.tr',
        'kızılay teknoloji': 'kizilaykariyer.com',
        'coral travel': 'coraltravel.com.tr',
    }

    def _domain_from_url(self, url):
        """Extract clean domain from URL."""
        if not url:
            return None
        try:
            parsed = urlparse(url)
            domain = parsed.netloc or parsed.path
            domain = domain.split(':')[0]  # remove port
            if domain.startswith('www.'):
                domain = domain[4:]
            return domain if '.' in domain else None
        except Exception:
            return None

    def _find_domain_for_company(self, company_name, application_url):
        """Try to resolve a domain for the company."""
        # 1. Try known domains map
        name_lower = (company_name or '').lower().strip()
        for key, domain in self.KNOWN_DOMAINS.items():
            if key in name_lower:
                return domain

        # 2. Try application URL domain
        domain = self._domain_from_url(application_url)
        if domain:
            # Skip job board domains - we want the company domain
            job_boards = (
                'linkedin.com', 'kariyer.net', 'youthall.com', 'indeed.com',
                'glassdoor.com', 'anbea.co', 'toptalent.co', 'savunmakariyer.com',
                'boomerangkariyergunleri.com',
            )
            if not any(jb in domain for jb in job_boards):
                return domain

        return None

    def _fetch_logo_from_domain(self, domain):
        """Try multiple methods to get a logo for a domain."""
        # Method 1: Google favicon service (always works, high-res)
        google_url = f'https://www.google.com/s2/favicons?domain={domain}&sz=128'
        try:
            resp = http_requests.head(google_url, timeout=5, allow_redirects=True)
            if resp.status_code == 200:
                # Google returns a default globe icon for unknown domains
                content_length = int(resp.headers.get('content-length', 0))
                if content_length > 500:  # real logos are > 500 bytes
                    return google_url
        except Exception:
            pass

        # Method 2: Google faviconV2 (newer, better quality)
        google_v2_url = (
            f'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON'
            f'&fallback_opts=TYPE,SIZE,URL&url=https://{domain}&size=128'
        )
        try:
            resp = http_requests.head(google_v2_url, timeout=5, allow_redirects=True)
            if resp.status_code == 200:
                content_length = int(resp.headers.get('content-length', 0))
                if content_length > 500:
                    return google_v2_url
        except Exception:
            pass

        return None

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        logo = adapter.get('company_logo_url')

        if logo:
            return item  # already has logo

        company = adapter.get('company_name', '')
        app_url = adapter.get('application_url', '')

        domain = self._find_domain_for_company(company, app_url)
        if domain:
            logo_url = self._fetch_logo_from_domain(domain)
            if logo_url:
                adapter['company_logo_url'] = logo_url
                spider.logger.info(f'LOGO_FOUND: {company} -> {logo_url}')
            else:
                spider.logger.debug(f'LOGO_NOT_FOUND: {company} (domain={domain})')
        else:
            spider.logger.debug(f'NO_DOMAIN: {company}')

        return item


class DeadlineValidationPipeline:
    """
    Validates deadline before DB save.
    Sets is_active=False and deadline_status='expired' for past deadlines.
    """

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        deadline = adapter.get('application_deadline')
        today = date.today()

        if deadline is not None and deadline < today:
            adapter['is_active'] = False
            adapter['deadline_status'] = 'expired'
            spider.logger.warning(
                f"EXPIRED_BEFORE_SAVE: {adapter['title']} (deadline={deadline})"
            )
        return item


class DjangoORMPipeline:
    """
    Saves scraped items to PostgreSQL via Django ORM.
    Upserts by source_url so reruns refresh existing records.
    """

    SOURCE_PRIORITY = {
        'youthall': 100,
        'anbea': 90,
        'boomerang': 85,
        'toptalent': 80,
        'savunma': 75,
        'linkedin': 70,
        'kariyer': 65,
    }

    def process_item(self, item, spider):
        from apps.listings.models import Listing

        adapter = ItemAdapter(item)
        classification = spider.get_sector_classification(
            adapter.get('title', ''),
            adapter.get('description', ''),
            adapter.get('company_name', ''),
            adapter.get('source_platform', ''),
        )
        url = self.normalize_source_url(
            adapter.get('source_platform', ''),
            adapter.get('source_url'),
        )

        if not url:
            spider.logger.warning('SKIPPED: No source_url')
            return item

        defaults = {
            'title': adapter.get('title', ''),
            'company_name': adapter.get('company_name', ''),
            'company_logo_url': adapter.get('company_logo_url'),
            'application_url': adapter.get('application_url') or url,
            'source_platform': adapter.get('source_platform', ''),
            'em_focus_area': classification.get('primary') or adapter.get('em_focus_area', 'diger'),
            'secondary_em_focus_area': classification.get('secondary') or adapter.get('secondary_em_focus_area'),
            'em_focus_confidence': classification.get('confidence', adapter.get('em_focus_confidence', 0)),
            'internship_type': adapter.get('internship_type', 'belirsiz'),
            'company_origin': adapter.get('company_origin', 'belirsiz'),
            'location': adapter.get('location', ''),
            'description': adapter.get('description', ''),
            'requirements': adapter.get('requirements', ''),
            'application_deadline': adapter.get('application_deadline'),
            'deadline_status': adapter.get('deadline_status', 'unknown'),
            'is_active': adapter.get('is_active', True),
            'is_talent_program': adapter.get('is_talent_program', False),
            'program_type': adapter.get('program_type'),
            'duration_weeks': adapter.get('duration_weeks'),
        }

        duplicate = self.find_cross_platform_duplicate(
            Listing=Listing,
            source_url=url,
            source_platform=defaults['source_platform'],
            title=defaults['title'],
            company_name=defaults['company_name'],
        )
        if duplicate:
            duplicate_priority = self.SOURCE_PRIORITY.get(duplicate.source_platform, 0)
            current_priority = self.SOURCE_PRIORITY.get(defaults['source_platform'], 0)
            if duplicate_priority >= current_priority:
                spider.logger.info(
                    'SKIPPED_DUPLICATE: %s | kept=%s | skipped=%s',
                    defaults['title'],
                    duplicate.source_platform,
                    defaults['source_platform'],
                )
                return item
            duplicate.delete()
            spider.logger.info(
                'REMOVED_DUPLICATE: %s | replaced=%s -> kept=%s',
                defaults['title'],
                duplicate.source_platform,
                defaults['source_platform'],
            )

        _, created = Listing.objects.update_or_create(
            source_url=url,
            defaults=defaults,
        )
        spider.logger.info(f'{"NEW" if created else "UPDATED"}: {adapter["title"]}')
        return item

    def normalize_source_url(self, source_platform: str, url: str | None) -> str:
        if not url:
            return ''
        if source_platform != 'linkedin':
            return url

        parts = urlsplit(url)
        clean_path = parts.path.rstrip('/')
        return urlunsplit((parts.scheme, parts.netloc, clean_path, '', ''))

    def normalize_dedupe_text(self, value: str | None) -> str:
        value = unicodedata.normalize('NFKD', value or '')
        value = value.encode('ascii', 'ignore').decode('ascii')
        value = value.lower()
        value = re.sub(r'\b(202\d|turkey|turkiye|programi|program|internship|intern|staj|stajyer)\b', ' ', value)
        value = re.sub(r'[^a-z0-9]+', ' ', value)
        return ' '.join(value.split())

    def find_cross_platform_duplicate(
        self,
        Listing,
        source_url: str,
        source_platform: str,
        title: str,
        company_name: str,
    ):
        normalized_title = self.normalize_dedupe_text(title)
        normalized_company = self.normalize_dedupe_text(company_name)
        if not normalized_title:
            return None

        candidates = Listing.objects.filter(is_active=True).exclude(source_url=source_url)
        if normalized_company:
            company_matches = []
            for candidate in candidates:
                candidate_company = self.normalize_dedupe_text(candidate.company_name)
                if not candidate_company or candidate_company == normalized_company:
                    company_matches.append(candidate)
            candidates = company_matches
        else:
            candidates = list(candidates)

        for candidate in candidates:
            if candidate.source_platform == source_platform:
                continue
            candidate_title = self.normalize_dedupe_text(candidate.title)
            if not candidate_title:
                continue
            similarity = SequenceMatcher(None, normalized_title, candidate_title).ratio()
            if similarity >= 0.78:
                return candidate
        return None
