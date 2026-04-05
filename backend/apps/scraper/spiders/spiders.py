"""
IUC Staj Platform - source spiders.

These spiders are intentionally conservative and prefer stable HTML/API
entry points over brittle client-side selectors.
"""

import json
import re
from datetime import date, datetime, timedelta
from html import unescape
from urllib.parse import quote_plus, urlparse, urljoin

import requests
from bs4 import BeautifulSoup
from scrapy import Request

from ..items import ScrapedListingItem
from .base_spider import BaseEMSpider


def extract_text(html: str) -> str:
    return BeautifulSoup(html or "", "html.parser").get_text(" ", strip=True)


def normalize_multiline_text(text: str) -> str:
    if not text:
        return ""
    text = unescape(text).replace("\xa0", " ").replace("\r", "")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def html_fragment_to_text(html: str) -> str:
    if not html:
        return ""
    normalized_html = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
    normalized_html = re.sub(
        r"</(p|div|section|article|h1|h2|h3|h4|h5|h6|ul|ol)>\s*",
        "\n\n",
        normalized_html,
        flags=re.I,
    )
    normalized_html = re.sub(r"<li\b[^>]*>", "\n- ", normalized_html, flags=re.I)
    normalized_html = re.sub(r"</li>\s*", "\n", normalized_html, flags=re.I)
    raw_text = BeautifulSoup(normalized_html, "html.parser").get_text("\n")

    lines: list[str] = []
    for segment in raw_text.splitlines():
        line = segment.strip()
        if not line:
            if lines and lines[-1] != "":
                lines.append("")
            continue
        if (
            lines
            and lines[-1] != ""
            and not line.startswith("-")
            and not lines[-1].startswith("-")
            and not re.search(r"[.!?:;]$", lines[-1])
        ):
            lines[-1] = f"{lines[-1]} {line}"
        else:
            lines.append(line)

    return normalize_multiline_text("\n".join(lines))


def iter_json_objects(value):
    if isinstance(value, dict):
        yield value
        return
    if isinstance(value, list):
        for item in value:
            yield from iter_json_objects(item)


def extract_jobposting_description_from_schema(soup: BeautifulSoup) -> str:
    for script in soup.select("script[type='application/ld+json']"):
        raw_json = script.string or script.get_text("\n", strip=True)
        if not raw_json:
            continue
        try:
            payload = json.loads(raw_json)
        except json.JSONDecodeError:
            continue

        for item in iter_json_objects(payload):
            if not isinstance(item, dict):
                continue
            item_type = item.get("@type")
            is_job_posting = item_type == "JobPosting" or (
                isinstance(item_type, list) and "JobPosting" in item_type
            )
            if not is_job_posting:
                continue

            description = html_fragment_to_text(str(item.get("description") or ""))
            if description:
                return description
    return ""


def extract_youthall_description(soup: BeautifulSoup) -> str:
    content = soup.select_one(".c-job_post_content")
    if content:
        content_soup = BeautifulSoup(str(content), "html.parser")
        for node in content_soup.select("script, style, noscript"):
            node.decompose()
        description = html_fragment_to_text(content_soup.decode_contents())
        if description:
            return description

    description = extract_jobposting_description_from_schema(soup)
    if description:
        return description

    meta_description = soup.find("meta", attrs={"name": "description"})
    if meta_description:
        return normalize_multiline_text(meta_description.get("content", ""))

    return ""


def translate_known_youthall_description(
    description: str,
    *,
    title: str = "",
    company_name: str = "",
    source_url: str = "",
) -> str:
    if not description:
        return ""

    normalized_title = normalize_multiline_text(title).casefold()
    normalized_company = normalize_multiline_text(company_name).casefold()
    normalized_source_url = (source_url or "").strip().casefold()

    is_shell_summer_training = (
        "shell türkiye summer training" in normalized_title
        or "shell turkiye summer training" in normalized_title
        or normalized_company == "shell"
        and "shell-turkiye-summer-training_" in normalized_source_url
    )
    if not is_shell_summer_training:
        return description

    replacements = (
        ("What awaits you during the program?", "Program süresince seni neler bekliyor?"),
        (
            "- Job introduction sessions to help you determine your career path,",
            "- Kariyer yolunu belirlemene yardımcı olacak iş tanıtım oturumları,",
        ),
        ("- Case analysis competitions,", "- Vaka analizi yarışmaları,"),
        ("- Tea-Talks session with our leaders,", "- Liderlerimizle Tea-Talks oturumları,"),
        (
            "- Site visits where you can observe workflows on site,",
            "- İş akışlarını yerinde gözlemleyebileceğin saha ziyaretleri,",
        ),
        (
            "- Sessions to explore Global career opportunities at Shell.",
            "- Shell'deki global kariyer fırsatlarını keşfedeceğin oturumlar.",
        ),
        (
            "- Training sessions for your personal development,",
            "- Kişisel gelişimini destekleyecek eğitim oturumları,",
        ),
        (
            "You can be the one! If you are...",
            "Eğer aşağıdaki özelliklere sahipsen, aradığımız kişi sen olabilirsin!",
        ),
        (
            "- A university preparatory, 1st or 2nd year student,",
            "- Üniversite hazırlık, 1. sınıf veya 2. sınıf öğrencisiysen,",
        ),
        (
            "- Reside in Istanbul between July and August,",
            "- Temmuz ve Ağustos ayları arasında İstanbul'da ikamet edebileceksen,",
        ),
        ("- Interested in the energy sector,", "- Enerji sektörüne ilgi duyuyorsan,"),
        (
            "- A creative and innovative perspective,",
            "- Yaratıcı ve yenilikçi bir bakış açısına sahipsen,",
        ),
        ("- A confident in your English,", "- İngilizcene güveniyorsan,"),
        (
            "Are you ready to take the next step? We’d love to have you with us!",
            "Bir sonraki adımı atmaya hazır mısın? Seni aramızda görmekten memnuniyet duyarız!",
        ),
        ("BE PART OF SHELL", "SHELL'İN BİR PARÇASI OL"),
    )

    translated = description
    for source, target in replacements:
        translated = translated.replace(source, target)

    return translated


def absolute_logo(base_url: str, value: str | None) -> str | None:
    if not value:
        return None
    if value.startswith("data:"):
        return None
    if value.startswith("http://") or value.startswith("https://"):
        return value
    if value.startswith("//"):
        parsed = urlparse(base_url)
        return f"{parsed.scheme}:{value}"
    return f"{base_url.rstrip('/')}/{value.lstrip('/')}"


def score_logo_candidate(
    url: str,
    *,
    alt_text: str = "",
    attrs_text: str = "",
    company_name: str = "",
) -> int:
    lowered_url = (url or "").lower()
    lowered_alt = (alt_text or "").lower()
    lowered_attrs = (attrs_text or "").lower()
    lowered_company = (company_name or "").lower()
    score = 0

    if not lowered_url.startswith(("http://", "https://")):
        return -100
    if any(marker in lowered_url for marker in ("sprite", "avatar", "profile", "placeholder")):
        score -= 6
    if any(marker in lowered_url for marker in ("logo", "brand", "company")):
        score += 8
    if any(marker in lowered_alt for marker in ("logo", "brand")):
        score += 8
    if any(marker in lowered_attrs for marker in ("logo", "brand")):
        score += 5
    if lowered_company:
        normalized_company = re.sub(r"[^a-z0-9]+", "", lowered_company)
        normalized_url = re.sub(r"[^a-z0-9]+", "", lowered_url)
        normalized_alt = re.sub(r"[^a-z0-9]+", "", lowered_alt)
        if normalized_company and normalized_company in normalized_url:
            score += 10
        if normalized_company and normalized_company in normalized_alt:
            score += 10
        for word in [part for part in re.split(r"\W+", lowered_company) if len(part) >= 3][:3]:
            if word in lowered_url:
                score += 4
            if word in lowered_alt:
                score += 4
    if lowered_url.endswith(".svg"):
        score += 1
    if any(marker in lowered_url for marker in ("favicon", "apple-touch-icon")):
        score -= 2
    return score


def extract_logo_url_from_html(
    base_url: str,
    html: str,
    *,
    company_name: str = "",
) -> str | None:
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")
    candidates: list[tuple[int, str]] = []

    for selector, bonus in (
        ("meta[property='og:image']", 10),
        ("meta[name='twitter:image']", 9),
        ("meta[property='og:image:url']", 10),
        ("link[rel='apple-touch-icon']", 2),
        ("link[rel='icon']", 1),
        ("link[rel='shortcut icon']", 1),
    ):
        for node in soup.select(selector):
            value = (node.get("content") or node.get("href") or "").strip()
            absolute = absolute_logo(base_url, value)
            if not absolute:
                continue
            score = score_logo_candidate(absolute, company_name=company_name) + bonus
            candidates.append((score, absolute))

    for img in soup.select("img[src], img[data-src], img[data-lazy-src]"):
        raw = (img.get("src") or img.get("data-src") or img.get("data-lazy-src") or "").strip()
        absolute = absolute_logo(base_url, raw)
        if not absolute:
            continue
        alt_text = img.get("alt") or ""
        attrs_text = " ".join(
            [
                img.get("class") and " ".join(img.get("class")) or "",
                img.get("id") or "",
                img.get("data-testid") or "",
            ]
        )
        score = score_logo_candidate(
            absolute,
            alt_text=alt_text,
            attrs_text=attrs_text,
            company_name=company_name,
        )
        candidates.append((score, absolute))

    if not candidates:
        return None

    candidates.sort(key=lambda item: item[0], reverse=True)
    best_score, best_url = candidates[0]
    return best_url if best_score >= 2 else None


def fetch_remote_logo_url(url: str | None, *, company_name: str = "") -> str | None:
    if not url:
        return None
    try:
        response = requests.get(
            url,
            timeout=30,
            headers={"User-Agent": "Mozilla/5.0"},
            allow_redirects=True,
        )
        response.raise_for_status()
        response.encoding = response.apparent_encoding or 'utf-8'
    except Exception:
        return None

    content_type = (response.headers.get("content-type") or "").lower()
    if "html" not in content_type:
        return None

    return extract_logo_url_from_html(response.url, response.text, company_name=company_name)


def find_external_link(response, blocked_domains: tuple[str, ...]) -> str | None:
    excluded_domains = {
        "facebook.com",
        "instagram.com",
        "twitter.com",
        "x.com",
        "youtube.com",
        "linkedin.com/company",
        "linkedin.com/school",
        "wa.me",
        "whatsapp.com",
    }
    preferred_markers = (
        "apply",
        "basvur",
        "career",
        "kariyer",
        "jobs",
        "job",
        "intern",
        "staj",
        "program",
        "yetenek",
        "workable",
        "greenhouse",
        "lever",
        "youthall",
        "linkedin.com/jobs",
        "lnkd.in",
    )

    candidates: list[tuple[int, str]] = []

    soup = BeautifulSoup(response.text or "", "html.parser")

    for anchor in soup.select("a[href]"):
        href = (anchor.get("href") or "").strip()
        if not href or href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:"):
            continue

        parts = re.split(r"\s*&\s*|\s+\|\s+|\s*,\s*", href)
        for raw_part in parts:
            part = raw_part.strip()
            if not part:
                continue
            absolute = response.urljoin(part)
            parsed = urlparse(absolute)
            hostname = parsed.netloc.lower()
            if not hostname:
                continue
            if any(domain in hostname for domain in blocked_domains):
                continue
            if any(domain in hostname for domain in excluded_domains):
                continue

            score = 0
            lowered = absolute.lower()
            link_text = anchor.css("::text").get("") or ""
            normalized_text = link_text.lower()
            if any(marker in lowered for marker in preferred_markers):
                score += 3
            if any(marker in normalized_text for marker in ("başvur", "basvur", "apply", "ilan", "kariyer", "staj")):
                score += 4
            if hostname.startswith("lnkd.in") or "linkedin.com/jobs" in lowered:
                score += 5
            if any(domain in hostname for domain in ("workable.com", "greenhouse.io", "lever.co", "youthall.com")):
                score += 5

            candidates.append((score, absolute))

    if not candidates:
        return None

    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]
    return None


def find_best_application_link(response, blocked_domains: tuple[str, ...]) -> str | None:
    excluded_targets = (
        "facebook.com",
        "instagram.com",
        "twitter.com",
        "x.com",
        "youtube.com",
        "linkedin.com/company",
        "linkedin.com/school",
        "wa.me",
        "whatsapp.com",
    )
    ats_targets = (
        "gethirex.com",
        "workable.com",
        "greenhouse.io",
        "lever.co",
        "youthall.com",
        "smartrecruiters.com",
        "successfactors.com",
        "jobteaser.com",
        "taleo.net",
        "myworkdayjobs.com",
        "linkedin.com/jobs",
        "lnkd.in",
    )
    generic_portals = (
        "kariyerkapisi.cbiko.gov.tr",
        "yetenekkapisi.org",
    )
    preferred_markers = (
        "apply",
        "basvur",
        "başvur",
        "career",
        "kariyer",
        "jobs",
        "job",
        "intern",
        "staj",
        "program",
        "yetenek",
    )

    candidates: list[tuple[int, str]] = []
    soup = BeautifulSoup(response.text or "", "html.parser")

    for anchor in soup.select("a[href]"):
        href = (anchor.get("href") or "").strip()
        if not href or href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:"):
            continue

        for raw_part in re.split(r"\s*&\s*|\s+\|\s+|\s*,\s*", href):
            part = raw_part.strip()
            if not part:
                continue

            absolute = response.urljoin(part)
            parsed = urlparse(absolute)
            hostname = parsed.netloc.lower()
            if not hostname:
                continue

            target = f"{hostname}{parsed.path.lower()}"
            if any(domain in hostname for domain in blocked_domains):
                continue
            if any(domain in target for domain in excluded_targets):
                continue

            text = " ".join(anchor.get_text(" ", strip=True).split()).lower()
            lowered = absolute.lower()
            score = 0

            if any(marker in lowered for marker in preferred_markers):
                score += 4
            if any(marker in text for marker in preferred_markers):
                score += 5
            if any(domain in target for domain in ats_targets):
                score += 10
            if parsed.query:
                score += 1
            if any(portal in hostname for portal in generic_portals) and parsed.path in ("", "/"):
                score -= 6

            candidates.append((score, absolute))

    if not candidates:
        return None

    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def find_known_job_url_in_html(html: str, blocked_domains: tuple[str, ...]) -> str | None:
    preferred_domains = (
        "gethirex.com",
        "workable.com",
        "greenhouse.io",
        "lever.co",
        "youthall.com",
        "smartrecruiters.com",
        "successfactors.com",
        "jobteaser.com",
        "taleo.net",
        "myworkdayjobs.com",
        "linkedin.com/jobs",
        "lnkd.in",
    )

    for match in re.findall(r"https?://[^\s\"'<>]+", html or "", flags=re.I):
        candidate = match.strip().rstrip(").,;")
        parsed = urlparse(candidate)
        hostname = parsed.netloc.lower()
        target = f"{hostname}{parsed.path.lower()}"
        if not hostname:
            continue
        if any(domain in hostname for domain in blocked_domains):
            continue
        if any(domain in target for domain in preferred_domains):
            return candidate

    return None


def has_listing_keywords(spider: BaseEMSpider, *chunks: str) -> bool:
    normalized = spider.normalize_turkish(" ".join(chunk for chunk in chunks if chunk))
    keywords = (
        "staj",
        "intern",
        "internship",
        "trainee",
        "management trainee",
        "mt",
        "yetenek program",
        "talent program",
        "graduate program",
        "uzun donem",
        "summer",
    )
    return any(keyword in normalized for keyword in keywords)


def resolve_redirect_url(url: str) -> str:
    try:
        response = requests.get(
            url,
            timeout=20,
            allow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        return response.url or url
    except Exception:
        return url


def fetch_remote_html(url: str) -> str:
    try:
        response = requests.get(
            url,
            timeout=20,
            allow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        response.encoding = response.apparent_encoding or 'utf-8'
        content_type = (response.headers.get("content-type") or "").lower()
        if "text/html" not in content_type and "application/xhtml" not in content_type:
            return ""
        return response.text or ""
    except Exception:
        return ""


def extract_deadline_from_remote_page(spider: BaseEMSpider, url: str) -> date | None:
    if not url:
        return None

    html = fetch_remote_html(url)
    if not html:
        return None

    text = spider.clean_text(BeautifulSoup(html, "html.parser").get_text(" ", strip=True))
    normalized = spider.normalize_turkish(text)

    schema_match = re.search(r'"validThrough"\s*:\s*"([^"]+)"', html)
    if schema_match:
        deadline = spider.parse_deadline(schema_match.group(1)[:10])
        if deadline:
            return deadline

    patterns = (
        r"son basvuru(?: tarihi)?[:\s]+(\d{1,2}[./]\d{1,2}[./]\d{4})",
        r"son basvuru(?: tarihi)?[:\s]+(\d{1,2}\s+[a-zçğıöşü]+\s+\d{4})",
        r"deadline[:\s]+([A-Za-z]+\s+\d{1,2},\s*\d{4})",
        r"deadline[:\s]+(\d{1,2}[./]\d{1,2}[./]\d{4})",
        r"important dates?.{0,50}(\d{1,2}[./]\d{1,2}[./]\d{4})",
        r"application deadline[:\s]+([A-Za-z]+\s+\d{1,2},\s*\d{4})",
    )

    for pattern in patterns:
        match = re.search(pattern, normalized if "a-zçğıöşü" in pattern else text, re.I)
        if not match:
            continue
        raw = match.group(1).replace("/", ".").strip()
        deadline = spider.parse_deadline(raw)
        if deadline:
            return deadline

    generic_match = re.search(r"(\d{4}-\d{2}-\d{2})", html)
    if generic_match:
        deadline = spider.parse_deadline(generic_match.group(1))
        if deadline:
            return deadline

    return None


class KariyerSpider(BaseEMSpider):
    name = "kariyer"
    MAX_PAGES = 5

    def start_requests(self):
        for page in range(1, self.MAX_PAGES + 1):
            url = f"https://www.kariyer.net/is-ilanlari?kw=staj&pn={page}"
            yield Request(url, callback=self.parse, meta={"page": page})

    def parse(self, response):
        soup = BeautifulSoup(response.text, "html.parser")
        seen = set()
        found = 0

        for anchor in soup.select("a[href*='/is-ilani/']"):
            href = anchor.get("href")
            preview = self.clean_text(anchor.get_text(" ", strip=True))
            if not href or href in seen:
                continue
            if "staj" not in preview.lower() and "intern" not in preview.lower():
                continue
            seen.add(href)
            found += 1
            yield response.follow(href, callback=self.parse_detail)

        self.logger.info("KARIYER_PAGE_%s: %s listings found", response.meta.get("page", 1), found)

    def parse_detail(self, response):
        soup = BeautifulSoup(response.text, "html.parser")
        meta_desc = soup.find("meta", attrs={"name": "description"})
        meta_desc = meta_desc.get("content", "") if meta_desc else ""
        page_title = soup.title.get_text(strip=True) if soup.title else ""
        text = self.clean_text(soup.get_text(" ", strip=True))

        company = ""
        title = page_title.split(" İş İlanı -", 1)[0].strip()
        match = re.search(r"Kariyer\.net'teki (.+?) firmasina ait (.+?) is ilanini", self.normalize_turkish(meta_desc))
        if match:
            company = match.group(1).strip().title()
            title = match.group(2).strip().title()

        description = ""
        desc_match = re.search(r"Is Ilani Hakkinda (.+?)(Benzer ilanlar|Sirket ilanlari|Basvur)", text, re.I)
        if desc_match:
            description = desc_match.group(1).strip()
        else:
            description = text[:3000]

        raw_dl = page_title.rsplit("-", 1)[-1].strip()
        deadline = self.parse_deadline(raw_dl)

        if raw_dl and deadline is None:
            self.logger.info("KARIYER_SKIPPED_EXPIRED: %s", title)
            return

        location_match = re.search(r"Kaydet Basvur (.+?) \d+ gun once guncellendi", self.normalize_turkish(text))
        location = location_match.group(1).strip().title() if location_match else ""

        yield ScrapedListingItem(
            title=title,
            company_name=company,
            company_logo_url=None,
            source_url=response.url,
            source_platform="kariyer",
            em_focus_area=self.detect_em_focus_area(title, description, company),
            internship_type=self.detect_internship_type(title, description),
            company_origin=self.detect_company_origin(company),
            location=location,
            description=description,
            requirements="",
            application_deadline=deadline,
            deadline_status=self.compute_deadline_status(deadline),
            is_active=deadline is None or deadline >= date.today(),
            is_talent_program="program" in self.normalize_turkish(f"{title} {description}"),
            program_type=self.detect_program_type(title, description),
            duration_weeks=None,
            scraped_at=datetime.utcnow(),
        )


class LinkedInSpider(BaseEMSpider):
    name = "linkedin"
    SEARCH_ENDPOINT = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
    PAGE_STARTS = [0, 25, 50, 75]
    PRIORITY_ROLE_KEYWORDS = [
        "staj",
        "stajyer",
        "uzun donem stajyer",
        "management trainee",
        "genc yetenek",
        "endustri muhendisligi",
        "endustri muhendisi",
        "endustri muhendisligi staj",
        "endustri muhendisligi stajyer",
        "industrial engineering intern",
        "supply chain intern",
        "logistics intern",
        "production planning intern",
        "quality assurance intern",
        "ar-ge stajyer",
    ]

    def build_search_urls(self) -> list[str]:
        seen = set()
        urls = []
        for query in self.PRIORITY_ROLE_KEYWORDS:
            cleaned = self.clean_text(query)
            if not cleaned:
                continue
            normalized = self.normalize_turkish(cleaned)
            if normalized in seen:
                continue
            seen.add(normalized)
            for start in self.PAGE_STARTS:
                urls.append(
                    f"{self.SEARCH_ENDPOINT}?keywords={quote_plus(cleaned)}&location=Turkey&start={start}"
                )

        self.logger.info("LINKEDIN_QUERY_COUNT: %s", len(urls))
        return urls

    def start_requests(self):
        for url in self.build_search_urls():
            yield Request(
                url,
                callback=self.parse_list,
                errback=self.handle_error,
            )

    def parse_list(self, response):
        cards = response.css("li")
        if not cards:
            self.logger.info("LINKEDIN_EMPTY_PAGE: %s", response.url)
            return

        for card in cards:
            url = card.css("a.base-card__full-link::attr(href)").get()
            title = self.clean_text(card.css("h3.base-search-card__title::text").get(""))
            company = self.clean_text(
                card.css("h4.base-search-card__subtitle a::text, h4.base-search-card__subtitle::text").get("")
            )
            location = self.normalize_location(card.css("span.job-search-card__location::text").get(""))
            logo = card.css(
                "img.artdeco-entity-image::attr(data-delayed-url), img.artdeco-entity-image::attr(src)"
            ).get()

            if not url or not title:
                continue
            if not self.is_turkiye_location(location):
                self.logger.info("LINKEDIN_SKIPPED_NON_TR: %s | %s", title, location)
                continue

            yield response.follow(
                url,
                callback=self.parse_detail,
                meta={
                    "title": title,
                    "company": company,
                    "location": location,
                    "logo": logo,
                },
                errback=self.handle_error,
            )

    def parse_detail(self, response):
        title = response.meta["title"]
        company = response.meta["company"] or self.clean_text(
            response.css("a.topcard__org-name-link::text, span.topcard__flavor a::text").get("")
        )
        desc = self.clean_text(
            response.css("div.show-more-less-html__markup, div.description__text").get("")
        )
        raw_dl = response.css("span.closing-time::text, span[class*='deadline']::text").get()
        deadline = self.parse_deadline(raw_dl)

        if raw_dl and deadline is None:
            self.logger.info("LINKEDIN_SKIPPED_EXPIRED: %s", title)
            return

        if not has_listing_keywords(self, title, company, desc):
            self.logger.info("LINKEDIN_SKIPPED_NON_INTERNSHIP: %s", title)
            return

        if not self.filter_by_keywords(title, desc):
            self.logger.info("LINKEDIN_SKIPPED_NON_EM: %s", title)
            return

        if self.targets_associate_degree(title, desc):
            self.logger.info("LINKEDIN_SKIPPED_ASSOCIATE_DEGREE: %s", title)
            return

        yield ScrapedListingItem(
            title=title,
            company_name=company,
            company_logo_url=response.meta.get("logo"),
            source_url=response.url,
            source_platform="linkedin",
            em_focus_area=self.detect_em_focus_area(title, desc, company),
            internship_type=self.detect_internship_type(title, desc),
            company_origin=self.detect_company_origin(company),
            location=response.meta.get("location", ""),
            description=desc,
            requirements="",
            application_deadline=deadline,
            deadline_status=self.compute_deadline_status(deadline),
            is_active=deadline is None or deadline >= date.today(),
            is_talent_program="program" in self.normalize_turkish(f"{title} {desc}"),
            program_type=self.detect_program_type(title, desc),
            duration_weeks=None,
            scraped_at=datetime.utcnow(),
        )

    def handle_error(self, failure):
        self.logger.error("LINKEDIN_ERROR: %s - %s", failure.request.url, failure.value)


class ItuKariyerLinkedinSpider(BaseEMSpider):
    name = "itukariyer_linkedin"
    start_urls = ["https://www.linkedin.com/company/itukariyer/"]
    BLOCKED_EXTERNAL_DOMAINS = (
        "linkedin.com/company",
        "linkedin.com/feed/hashtag",
        "linkedin.com/signup",
        "linkedin.com/shareArticle",
        "tr.linkedin.com/company",
    )

    def parse(self, response):
        resp = requests.get(
            response.url,
            timeout=30,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        resp.encoding = resp.apparent_encoding or 'utf-8'
        html = resp.text
        soup = BeautifulSoup(html, "html.parser")

        for card in soup.select("article[data-id='main-feed-card']"):
            container = card.find_parent("div", attrs={"data-id": "entire-feed-card-link"}) or card.parent
            overlay = container.select_one("a[data-id='main-feed-card__full-link']") if container else None
            commentary_node = card.select_one("p[data-test-id='main-feed-activity-card__commentary']")
            actor_link = card.select_one("a[data-tracking-control-name*='feed-actor-name']")
            actor_img = card.select_one("img[data-delayed-url]")
            if not overlay or not commentary_node:
                continue

            source_url = (overlay.get("href") or "").strip()
            raw_commentary = commentary_node.get_text("\n", strip=True)
            commentary = self.clean_text(raw_commentary)
            company = self.clean_text(actor_link.get_text(" ", strip=True)) if actor_link else ""
            company_logo_url = actor_img.get("data-delayed-url") if actor_img else None

            external_url = None
            for link in commentary_node.select("a[href]"):
                href = (link.get("href") or "").strip()
                if not href:
                    continue
                lowered = href.lower()
                if any(domain in lowered for domain in self.BLOCKED_EXTERNAL_DOMAINS):
                    continue
                external_url = href
                break

            if not source_url or not commentary or not external_url:
                continue

            application_url = resolve_redirect_url(external_url)
            title = self.extract_title_from_commentary(raw_commentary)
            deadline = self.extract_deadline_from_commentary(commentary)
            if deadline is None:
                deadline = extract_deadline_from_remote_page(self, application_url)
            if not company_logo_url:
                company_logo_url = fetch_remote_logo_url(application_url, company_name=company)

            if not has_listing_keywords(self, title, commentary):
                continue

            yield ScrapedListingItem(
                title=title,
                company_name=company or "ITU Kariyer LinkedIn",
                company_logo_url=company_logo_url,
                source_url=source_url,
                application_url=application_url,
                source_platform="itu_kariyer",
                em_focus_area=self.detect_em_focus_area(title, commentary, company),
                internship_type=self.detect_internship_type(title, commentary),
                company_origin=self.detect_company_origin(company),
                location="Turkiye",
                description=commentary[:4000],
                requirements="",
                application_deadline=deadline,
                deadline_status=self.compute_deadline_status(deadline),
                is_active=deadline is None or deadline >= date.today(),
                is_talent_program="program" in self.normalize_turkish(f"{title} {commentary}"),
                program_type=self.detect_program_type(title, commentary),
                duration_weeks=None,
                scraped_at=datetime.utcnow(),
            )

    def extract_title_from_commentary(self, commentary: str) -> str:
        first_line = next((line.strip() for line in commentary.splitlines() if line.strip()), "")
        if first_line:
            return self.clean_text(first_line)
        first_sentence = commentary.split(".", 1)[0].strip()
        return self.clean_text(first_sentence)

    def extract_deadline_from_commentary(self, commentary: str) -> date | None:
        normalized = self.normalize_turkish(commentary)
        match = re.search(
            r"son basvuru[:\s]+(\d{1,2}\s+[a-zçğıöşü]+(?:\s+\d{4})?)",
            normalized,
            re.I,
        )
        if not match:
            match = re.search(
                r"deadline[:\s]+([a-zA-Z]+\s+\d{1,2},?\s*\d{4}?)",
                commentary,
                re.I,
            )
        if not match:
            return None

        raw = match.group(1).strip()
        if re.match(r"^\d{1,2}\s+[a-zçğıöşü]+$", raw, re.I):
            raw = f"{raw} {date.today().year}"
        return self.parse_deadline(raw)


class YouthallSpider(BaseEMSpider):
    name = "youthall"
    start_urls = ["https://www.youthall.com/tr/jobs/"]

    def extract_deadline(self, html: str, text: str) -> tuple[date | None, bool]:
        valid_through_match = re.search(r'"validThrough"\s*:\s*"([^"]+)"', html)
        if valid_through_match:
            raw_deadline = self.clean_text(valid_through_match.group(1))
            deadline = self.parse_deadline(raw_deadline[:10])
            return deadline, True

        date_match = re.search(r"(\d{2}\.\d{2}\.\d{4})", text)
        if date_match:
            deadline = self.parse_deadline(date_match.group(1))
            return deadline, True

        return None, False

    def parse(self, response):
        soup = BeautifulSoup(response.text, "html.parser")
        seen = set()

        for anchor in soup.select("a[href]"):
            href = anchor.get("href")
            if not href:
                continue
            full_url = response.urljoin(href)
            if "/tr/" not in full_url:
                continue
            if not re.search(r"/tr/[^/]+/.+_\d+/?$", full_url) and "/tr/talent-programs/" not in full_url:
                continue
            if full_url in seen:
                continue
            seen.add(full_url)
            yield Request(full_url, callback=self.parse_detail)

        next_link = response.css("a.next::attr(href), a[rel='next']::attr(href), li.next a::attr(href)").get()
        if next_link:
            yield Request(response.urljoin(next_link), callback=self.parse)

    def parse_detail(self, response):
        soup = BeautifulSoup(response.text, "html.parser")
        text = self.clean_text(soup.get_text(" ", strip=True))
        description = extract_youthall_description(soup) or text[:4000]
        company = self.clean_text((soup.find("h1") or {}).get_text(" ", strip=True) if soup.find("h1") else "")
        page_title = soup.title.get_text(strip=True).replace(" - Youthall", "") if soup.title else company
        title = page_title
        if company and page_title.startswith(company):
            title = page_title[len(company):].strip() or page_title
        description = translate_known_youthall_description(
            description,
            title=title,
            company_name=company,
            source_url=response.url,
        )
        logo_url = extract_logo_url_from_html(response.url, response.text, company_name=company)

        deadline, has_deadline = self.extract_deadline(response.text, text)
        if has_deadline and deadline is None:
            self.logger.info("YOUTHALL_SKIPPED_EXPIRED: %s", title)
            return

        yield ScrapedListingItem(
            title=title,
            company_name=company,
            company_logo_url=logo_url,
            source_url=response.url,
            source_platform="youthall",
            em_focus_area=self.detect_em_focus_area(title, description, company),
            internship_type=self.detect_internship_type(title, description),
            company_origin=self.detect_company_origin(company),
            location="Turkiye",
            description=description,
            requirements="",
            application_deadline=deadline,
            deadline_status=self.compute_deadline_status(deadline),
            is_active=deadline is None or deadline >= date.today(),
            is_talent_program="program" in self.normalize_turkish(f"{title} {description}"),
            program_type=self.detect_program_type(title, description),
            duration_weeks=None,
            scraped_at=datetime.utcnow(),
        )


class AnbeaSpider(BaseEMSpider):
    name = "anbea"
    start_urls = ["https://anbeankampus.co/ilanlar/"]
    BLOCKED_DETAIL_PATTERNS = (
        "/cv-",
        "/cv/",
        "/sss",
        "/sikca-sorulan",
        "/yks",
        "/hedef",
        "/meslek-",
        "/universite-",
        "/ogrenci-",
        "/blog/",
        "/giris",
        "/kayitol",
        "/podcast/",
        "/kulupler/",
        "/kulup-basvuru/",
        "/webinar/",
        "/hikayemiz/",
        "/iletisim",
        "/yardim-merkezi/",
        "/kvkk",
        "/kullanicisozlesmesi",
        "/gizlilik-politikasi",
        "/sirketler/",
        "/sirketler-icin/",
        "/etkinlikler/",
        "/online-sertifika-programlari/",
        "/ucretsiz-cv-",
        "/meslek-testi/",
        "/ilanlar/staj-ilanlari/",
        "/ilanlar/yetenek-programlari/",
        "/ilanlar/yeni-mezun-is-ilanlari/",
        "/ilanlar/part-time-is-ilanlari/",
        "/ilanlar/tam-zamanli-is-ilanlari/",
        "/ilanlar/mt-programi/",
        "/ilanlar/kampus-elciligi/",
        "/ilanlar/diger/",
    )

    def extract_deadline(self, html: str, text: str, preview_text: str = "") -> tuple[date | None, bool]:
        normalized_text = self.normalize_turkish(text)
        normalized_preview = self.normalize_turkish(preview_text)

        relative_match = re.search(r"son\s+(\d+)\s+gun", normalized_preview)
        if relative_match:
            deadline = date.today() + timedelta(days=int(relative_match.group(1)))
            return deadline, True

        title_deadline_match = re.search(
            r"son basvuru tarihi[:\s]+(\d{2}[./]\d{2}[./]\d{4})",
            normalized_text,
        )
        if title_deadline_match:
            deadline = self.parse_deadline(title_deadline_match.group(1).replace("/", "."))
            return deadline, True

        meta_deadline_match = re.search(r'"validThrough"\s*:\s*"([^"]+)"', html)
        if meta_deadline_match:
            deadline = self.parse_deadline(meta_deadline_match.group(1)[:10])
            return deadline, True

        generic_match = re.search(
            r"(son basvuru|deadline|important dates?).{0,40}(\d{2}[./]\d{2}[./]\d{4})",
            normalized_text,
        )
        if generic_match:
            deadline = self.parse_deadline(generic_match.group(2).replace("/", "."))
            return deadline, True

        iso_match = re.search(r"(\d{4}-\d{2}-\d{2})", html)
        if iso_match:
            deadline = self.parse_deadline(iso_match.group(1))
            return deadline, True

        return None, False

    def is_listing_path(self, href: str) -> bool:
        if not href or not href.startswith("/"):
            return False
        if "?" in href or "#" in href:
            return False
        if any(pattern in href for pattern in self.BLOCKED_DETAIL_PATTERNS):
            return False

        path_parts = [part for part in urlparse(href).path.strip("/").split("/") if part]
        if len(path_parts) != 2:
            return False
        if path_parts[0] == "ilanlar":
            return False
        return True

    def parse(self, response):
        soup = BeautifulSoup(response.text, "html.parser")
        seen = set()

        for anchor in soup.select("a[href]"):
            href = anchor.get("href")
            if not self.is_listing_path(href):
                continue
            full_url = response.urljoin(href)
            if full_url in seen:
                continue
            seen.add(full_url)
            yield response.follow(full_url, callback=self.parse_detail)

        next_link = response.css("a.next::attr(href), a[rel='next']::attr(href), li.next a::attr(href), a.next.page-numbers::attr(href)").get()
        if next_link:
            yield Request(response.urljoin(next_link), callback=self.parse)

    def parse_detail(self, response):
        if not title:
            return
        if title in {"Staj İlanları", "Yetenek Programları", "Management Trainee (MT) Programı İlanları"}:
            return
        path_parts = [p for p in urlparse(response.url).path.strip("/").split("/") if p]
        company = path_parts[0].replace("-", " ").title() if path_parts else ""
        if company.lower() == "ilanlar":
            return

        deadline, has_deadline = self.extract_deadline(response.text, text)
        if has_deadline and deadline is None:
            self.logger.info("ANBEA_SKIPPED_EXPIRED: %s", title)
            return

        yield ScrapedListingItem(
            title=title,
            company_name=company,
            company_logo_url=None,
            source_url=response.url,
            source_platform="anbea",
            em_focus_area=self.detect_em_focus_area(title, text, company),
            internship_type=self.detect_internship_type(title, text),
            company_origin=self.detect_company_origin(company),
            location="Turkiye",
            description=text[:4000],
            requirements="",
            application_deadline=deadline,
            deadline_status=self.compute_deadline_status(deadline),
            is_active=deadline is None or deadline >= date.today(),
            is_talent_program="program" in self.normalize_turkish(f"{title} {text}"),
            program_type=self.detect_program_type(title, text),
            duration_weeks=None,
            scraped_at=datetime.utcnow(),
        )


class BoomerangSpider(BaseEMSpider):
    name = "boomerang"
    start_urls = [
        "https://www.boomerang.careers/talent-programs",
        "https://www.boomerang.careers/career-events",
    ]

    def extract_deadline(self, html: str, text: str, preview_text: str = "") -> tuple[date | None, bool]:
        normalized_text = self.normalize_turkish(text)
        normalized_preview = self.normalize_turkish(preview_text)

        relative_match = re.search(r"son\s+(\d+)\s+gun", normalized_preview)
        if relative_match:
            deadline = date.today() + timedelta(days=int(relative_match.group(1)))
            return deadline, True

        event_date_match = re.search(
            r"Etkinlik Tarihi\s+(\d{2}/\d{2}/\d{4})",
            text,
            re.I,
        )
        if event_date_match:
            deadline = self.parse_deadline(event_date_match.group(1).replace("/", "."))
            return deadline, True

        deadline_match = re.search(
            r"Son Basvuru Tarihi\s+(\d{2}/\d{2}/\d{4})",
            normalized_text,
        )
        if deadline_match:
            deadline = self.parse_deadline(deadline_match.group(1).replace("/", "."))
            return deadline, True

        generic_slash_match = re.search(r"(\d{2}/\d{2}/\d{4})", text)
        if generic_slash_match:
            deadline = self.parse_deadline(generic_slash_match.group(1).replace("/", "."))
            return deadline, True

        generic_iso_match = re.search(r"(\d{4}-\d{2}-\d{2})", html)
        if generic_iso_match:
            deadline = self.parse_deadline(generic_iso_match.group(1))
            return deadline, True

        return None, False

    def parse(self, response):
        soup = BeautifulSoup(response.text, "html.parser")
        seen = set()
        for anchor in soup.select("a[href]"):
            href = anchor.get("href")
            if not href:
                continue
            full_url = response.urljoin(href)
            if not (
                ("/talent-programs/" in full_url and not full_url.endswith("/talent-programs"))
                or ("/career-events/" in full_url and not full_url.endswith("/career-events"))
            ):
                continue
            if full_url in seen:
                continue
            seen.add(full_url)
            yield Request(full_url, callback=self.parse_detail)

        next_link = response.css("a.next::attr(href), a[rel='next']::attr(href), li.next a::attr(href), a.next.page-numbers::attr(href)").get()
        if next_link:
            yield Request(response.urljoin(next_link), callback=self.parse)

    def parse_detail(self, response):
        text = self.clean_text(BeautifulSoup(response.text, "html.parser").get_text(" ", strip=True))
        title = ""
        title_match = re.search(r"Boomerang -\s*(.+?)\s+Anasayfa", text)
        if title_match:
            title = title_match.group(1).strip()
        if not title:
            title = self.clean_text(response.css("h1::text").get(""))

        company_match = re.search(r"Duzenleyen\s+(.+?)\s+Konum", self.normalize_turkish(text))
        location_match = re.search(r"Konum\s+(.+?)\s+Tur", text, re.I)
        desc_match = re.search(
            r"(Program Hakkinda|Etkinlik Hakkinda)\s+(.+?)\s+Iletisim",
            text,
            re.I,
        )

        company = company_match.group(1).strip().title() if company_match else ""
        location = location_match.group(1).strip() if location_match else "Turkiye"
        deadline, has_deadline = self.extract_deadline(response.text, text)
        if has_deadline and deadline is None:
            self.logger.info("BOOMERANG_SKIPPED_EXPIRED: %s", title)
            return
        description = desc_match.group(2).strip() if desc_match else text[:4000]
        logo_url = extract_logo_url_from_html(response.url, response.text, company_name=company)

        yield ScrapedListingItem(
            title=title,
            company_name=company,
            company_logo_url=logo_url,
            source_url=response.url,
            source_platform="boomerang",
            em_focus_area=self.detect_em_focus_area(title, description, company),
            internship_type=self.detect_internship_type(title, description),
            company_origin=self.detect_company_origin(company),
            location=location,
            description=description,
            requirements="",
            application_deadline=deadline,
            deadline_status=self.compute_deadline_status(deadline),
            is_active=deadline is None or deadline >= date.today(),
            is_talent_program=True,
            program_type=self.detect_program_type(title, description),
            duration_weeks=None,
            scraped_at=datetime.utcnow(),
        )


class TopTalentSpider(BaseEMSpider):
    name = "toptalent"
    start_urls = [
        "https://toptalent.co/is-ilanlari",
        "https://toptalent.co/yetenek-programlari",
    ]
    BLOCKED_DETAIL_PATTERNS = (
        "/is-ilanlari",
        "/yetenek-programlari",
        "/etkinlikler",
        "/yetenek-testleri",
        "/sirket",
        "/ucretsiz-is-ilani-ver",
        "/isveren",
        "/assessment-aday-degerlendirme-ve-ise-alim-testleri",
        "/insan-kaynaklari-platformu",
        "/iletisim",
        "/hakkimizda",
        "/yetenek-aydinlatma-metni",
        "/isveren-aydinlatma-metni",
        "/sartlar-ve-kosullar",
        "/gizlilik-politikasi",
        "/cerez-politikasi",
        "/online-egitim-sertifika-programlari",
        "/sirketler",
        "/cv-hazirlama",
        "/en-onemli-is-gorusmesi-sorulari-ve-cevaplari",
        "/kariyer-tavsiyeleri",
        "/turkiyedeki-universiteler-listesi",
        "/is-hayati-egitimleri",
        "/dijital-pazarlama-egitimleri",
        "/finans-egitimleri",
        "/girisimcilik-ve-eticaret-egitimleri",
        "/ingilizce-ogrenme-ingilizce-kurslari",
        "/insan-kaynaklari-egitimleri",
        "/kisisel-gelisim-kitaplari",
        "/excel-egitimleri",
        "/muhendislik-egitimleri",
        "/online-staj-programlari",
        "/teknoloji-ve-yazilim-egitimleri",
        "/ingilizce-seviye-testi",
        "/genel-yetenek-testi",
        "/kisilik-testi",
        "/excel-testi",
        "/microsoft-office-testi",
        "/almanca-seviye-testi",
        "/dijital-pazarlama",
        "/iq-testi",
        "/meslek-testi",
        "/enneagram-testi",
        "/kisisel-gelisim-plani",
        "/mulakat-sorulari-ve-cevaplari-simulasyonu",
        "/ise-alim-cozumlerimiz",
        "/isveren-markasi",
        "/insan-kaynaklari-trend-raporlari",
        "/top100talentprogram",
    )

    def extract_deadline(self, html: str, text: str, preview_text: str = "") -> tuple[date | None, bool]:
        normalized_text = self.normalize_turkish(text)
        normalized_preview = self.normalize_turkish(preview_text)

        relative_match = re.search(r"son\s+(\d+)\s+gun", normalized_preview)
        if relative_match:
            deadline = date.today() + timedelta(days=int(relative_match.group(1)))
            return deadline, True

        question_match = re.search(
            r"son basvuru tarihi ne zaman\?\s+(\d{1,2}\s+[a-zA-ZığüşöçİĞÜŞÖÇ]+\s+\d{4})",
            text,
            re.I,
        )
        if question_match:
            deadline = self.parse_deadline(question_match.group(1))
            return deadline, True

        english_label_match = re.search(
            r"Deadline:\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})",
            text,
            re.I,
        )
        if english_label_match:
            deadline = self.parse_deadline(english_label_match.group(1))
            return deadline, True

        label_match = re.search(
            r"son basvuru tarihi[:\s]+(\d{1,2}\s+[a-zA-ZığüşöçİĞÜŞÖÇ]+\s+\d{4}|\d{2}[./]\d{2}[./]\d{4})",
            normalized_text,
        )
        if label_match:
            deadline = self.parse_deadline(label_match.group(1).replace("/", "."))
            return deadline, True

        schema_match = re.search(r'"validThrough"\s*:\s*"([^"]+)"', html)
        if schema_match:
            deadline = self.parse_deadline(schema_match.group(1)[:10])
            return deadline, True

        generic_match = re.search(
            r"(son basvuru|deadline|important dates?).{0,40}(\d{2}[./]\d{2}[./]\d{4})",
            normalized_text,
        )
        if generic_match:
            deadline = self.parse_deadline(generic_match.group(2).replace("/", "."))
            return deadline, True

        return None, False

    def is_listing_path(self, href: str) -> bool:
        if not href or not href.startswith("/"):
            return False
        href = href.strip()
        if "?" in href or "#" in href or href.endswith(" "):
            return False
        if any(href == pattern or href.startswith(f"{pattern}/") for pattern in self.BLOCKED_DETAIL_PATTERNS):
            return False
        path_parts = [part for part in href.strip("/").split("/") if part]
        return len(path_parts) == 1

    def parse(self, response):
        soup = BeautifulSoup(response.text, "html.parser")
        seen = set()
        for anchor in soup.select("a[href]"):
            href = anchor.get("href")
            if not self.is_listing_path(href):
                continue
            full_url = response.urljoin(href)
            if full_url in seen:
                continue
            seen.add(full_url)
            yield response.follow(
                full_url,
                callback=self.parse_detail,
                meta={"listing_preview": self.clean_text(anchor.get_text(" ", strip=True))},
            )

        next_link = response.css("a.next::attr(href), a[rel='next']::attr(href), li.next a::attr(href), a.next.page-numbers::attr(href)").get()
        if next_link:
            yield Request(response.urljoin(next_link), callback=self.parse)

    def parse_detail(self, response):
        soup = BeautifulSoup(response.text, "html.parser")
        text = self.clean_text(soup.get_text(" ", strip=True))
        page_title = soup.title.get_text(strip=True) if soup.title else ""

        title = ""
        company = ""
        match = re.search(r"Toptalent\.co \|\s*(.+?)\s*-\s*(.+)$", page_title)
        if match:
            title = match.group(1).strip()
            company = match.group(2).strip()
        else:
            title = page_title.replace("Toptalent.co |", "").strip()

        if not title:
            return

        location_match = re.search(r"Lokasyon\s+(.+?)\s+Kimler Basvurabilir", self.normalize_turkish(text))
        location = location_match.group(1).strip().title() if location_match else "Turkiye"
        desc_match = re.search(r"(Program Tanimi|Ilan Aciklamasi)\s+(.+?)\s+(Kimler Basvurabilir|Basvuru Kriterleri|Sirketi Incele)", text, re.I)
        description = desc_match.group(2).strip() if desc_match else text[:4000]
        logo_url = extract_logo_url_from_html(response.url, response.text, company_name=company)
        deadline, has_deadline = self.extract_deadline(
            response.text,
            text,
            response.meta.get("listing_preview", ""),
        )
        if has_deadline and deadline is None:
            self.logger.info("TOPTALENT_SKIPPED_EXPIRED: %s", title)
            return

        yield ScrapedListingItem(
            title=title,
            company_name=company,
            company_logo_url=logo_url,
            source_url=response.url,
            application_url=response.url,
            source_platform="toptalent",
            em_focus_area=self.detect_em_focus_area(title, description, company),
            internship_type=self.detect_internship_type(title, description),
            company_origin=self.detect_company_origin(company),
            location=location,
            description=description,
            requirements="",
            application_deadline=deadline,
            deadline_status=self.compute_deadline_status(deadline),
            is_active=deadline is None or deadline >= date.today(),
            is_talent_program="program" in self.normalize_turkish(f"{title} {description}"),
            program_type=self.detect_program_type(title, description),
            duration_weeks=None,
            scraped_at=datetime.utcnow(),
        )


class OdtuKpmSpider(BaseEMSpider):
    name = "odtu_kpm"
    start_urls = ["https://kpm.metu.edu.tr/category/staj-ilanlari/"]
    BLOCKED_EXTERNAL_DOMAINS = (
        "kpm.metu.edu.tr",
        "metu.edu.tr",
        "wordpress.org",
        "athemes.com",
        "kariyerfuari.metu.edu.tr",
    )

    def parse(self, response):
        soup = BeautifulSoup(response.text, "html.parser")
        seen = set()

        for anchor in soup.select("h2.entry-title a[href], article h2 a[href], a[rel='bookmark']"):
            href = anchor.get("href")
            if not href:
                continue
            full_url = response.urljoin(href)
            if full_url in seen:
                continue
            seen.add(full_url)
            yield Request(full_url, callback=self.parse_detail)

        next_link = response.css("a.next.page-numbers::attr(href), a[rel='next']::attr(href)").get()
        if next_link:
            yield Request(response.urljoin(next_link), callback=self.parse)

    def parse_detail(self, response):
        soup = BeautifulSoup(response.text, "html.parser")
        title = self.clean_text(
            response.css("h1.entry-title::text, h1.title-post::text").get("")
            or (soup.title.get_text(strip=True) if soup.title else "")
        )
        article = soup.select_one("article") or soup
        description = self.clean_text(article.get_text(" ", strip=True))[:4000]
        application_url = find_known_job_url_in_html(response.text, self.BLOCKED_EXTERNAL_DOMAINS) or find_best_application_link(
            response, self.BLOCKED_EXTERNAL_DOMAINS
        )
        deadline_match = re.search(
            r"son basvuru tarihi[:\s]+([^\n]+)",
            self.normalize_turkish(description),
        )
        deadline = self.parse_deadline(deadline_match.group(1).strip()) if deadline_match else None
        if deadline is None:
            deadline = extract_deadline_from_remote_page(self, application_url)

        if not application_url or not has_listing_keywords(self, title, description):
            return

        company = ""
        page_title = soup.title.get_text(" ", strip=True) if soup.title else ""
        if "|" in page_title:
            parts = [part.strip() for part in page_title.split("|")]
            if len(parts) >= 2:
                company = parts[1].split("–", 1)[0].split("-", 1)[0].strip()
        company = company or self.clean_text(response.css("meta[property='og:site_name']::attr(content)").get("")) or "ODTU KPM Ilani"
        logo_url = extract_logo_url_from_html(response.url, response.text, company_name=company) or fetch_remote_logo_url(
            application_url,
            company_name=company,
        )

        yield ScrapedListingItem(
            title=title,
            company_name=company,
            company_logo_url=logo_url,
            source_url=response.url,
            application_url=application_url,
            source_platform="odtu_kpm",
            em_focus_area=self.detect_em_focus_area(title, description, company),
            internship_type=self.detect_internship_type(title, description),
            company_origin=self.detect_company_origin(company),
            location="Turkiye",
            description=description,
            requirements="",
            application_deadline=deadline,
            deadline_status=self.compute_deadline_status(deadline),
            is_active=deadline is None or deadline >= date.today(),
            is_talent_program="program" in self.normalize_turkish(f"{title} {description}"),
            program_type=self.detect_program_type(title, description),
            duration_weeks=None,
            scraped_at=datetime.utcnow(),
        )


class BogaziciKariyerSpider(BaseEMSpider):
    name = "bogazici_km"
    start_urls = ["https://kariyermerkezi.bogazici.edu.tr/is_ve_staj_ilanlari"]
    BLOCKED_EXTERNAL_DOMAINS = (
        "kariyermerkezi.bogazici.edu.tr",
        "bogazici.edu.tr",
        "boun.edu.tr",
        "bilgiislem.bogazici.edu.tr",
        "kariyerkapisi.cbiko.gov.tr",
        "yetenekkapisi.org",
    )

    def parse(self, response):
        seen = set()
        for href in response.css("a[href*='/is-ve-staj-ilanlari/']::attr(href)").getall():
            full_url = response.urljoin(href)
            if full_url in seen or full_url.rstrip("/") == response.url.rstrip("/"):
                continue
            seen.add(full_url)
            yield Request(full_url, callback=self.parse_detail)

        next_link = response.css("li.pager-next a::attr(href), a[rel='next']::attr(href)").get()
        if next_link:
            yield Request(response.urljoin(next_link), callback=self.parse)

    def parse_detail(self, response):
        soup = BeautifulSoup(response.text, "html.parser")
        title = self.clean_text(response.css("h1::text").get(""))
        description = self.clean_text(soup.get_text(" ", strip=True))[:4000]
        application_url = find_best_application_link(response, self.BLOCKED_EXTERNAL_DOMAINS)

        if not title or not application_url or not has_listing_keywords(self, title, description):
            return

        company_match = re.search(r"Firma Adi/Company Name\s+(.+?)\s+(Sehir/City|Pozisyon Adi/Position Name)", description, re.I)
        if not company_match:
            company_match = re.search(r"Firma Adı/Company Name\s+(.+?)\s+(Şehir/City|Pozisyon Adı/Position Name)", soup.get_text(" ", strip=True), re.I)
        company = self.clean_text(company_match.group(1)) if company_match else "Bogazici Kariyer Ilani"

        location_match = re.search(r"Sehir/City\s+(.+?)\s+Ilan Bilgileri/Job Announcement Info", description, re.I)
        if not location_match:
            location_match = re.search(r"Şehir/City\s+(.+?)\s+İlan Bilgileri/Job Announcement Info", soup.get_text(" ", strip=True), re.I)
        location = self.clean_text(location_match.group(1)) if location_match else "Turkiye"

        deadline_match = re.search(r"Son Basvuru Tarihi\s+([^\s:]+(?:\s+\d{4})?)", self.normalize_turkish(description), re.I)
        deadline = self.parse_deadline(deadline_match.group(1).strip()) if deadline_match else None

        yield ScrapedListingItem(
            title=title,
            company_name=company,
            company_logo_url=None,
            source_url=response.url,
            application_url=application_url,
            source_platform="bogazici_km",
            em_focus_area=self.detect_em_focus_area(title, description, company),
            internship_type=self.detect_internship_type(title, description),
            company_origin=self.detect_company_origin(company),
            location=location,
            description=description,
            requirements="",
            application_deadline=deadline,
            deadline_status=self.compute_deadline_status(deadline),
            is_active=deadline is None or deadline >= date.today(),
            is_talent_program="program" in self.normalize_turkish(f"{title} {description}"),
            program_type=self.detect_program_type(title, description),
            duration_weeks=None,
            scraped_at=datetime.utcnow(),
        )


class YtuOrkamSpider(BaseEMSpider):
    name = "ytu_orkam"
    start_urls = ["https://orkam.yildiz.edu.tr/is-ve-staj-ilanlari/"]
    BLOCKED_EXTERNAL_DOMAINS = (
        "orkam.yildiz.edu.tr",
        "yildiz.edu.tr",
        "ytu.edu.tr",
        "twitter.com",
        "x.com",
        "instagram.com",
        "facebook.com",
        "linkedin.com/company",
        "linkedin.com/shareArticle",
        "kariyerkapisi.cbiko.gov.tr",
        "yetenekkapisi.org",
    )

    def parse(self, response):
        soup = BeautifulSoup(response.text, "html.parser")
        seen = set()

        for anchor in soup.select(".entry-title a[href], article h2 a[href], h2.entry-title a[href], a[rel='bookmark']"):
            href = anchor.get("href")
            if not href:
                continue
            full_url = response.urljoin(href)
            if full_url in seen:
                continue
            seen.add(full_url)
            yield Request(full_url, callback=self.parse_detail)

        next_link = response.css("a.next.page-numbers::attr(href), a[rel='next']::attr(href)").get()
        if next_link:
            yield Request(response.urljoin(next_link), callback=self.parse)

    def extract_deadline(self, text: str) -> tuple[date | None, bool]:
        normalized = self.normalize_turkish(text)
        match = re.search(
            r"son basvuru tarihi[:\s]+(\d{1,2}[./]\d{1,2}[./]\d{4}|\d{1,2}\s+[a-zçğıöşü]+\s+\d{4})",
            normalized,
            re.I,
        )
        if match:
            raw = match.group(1).replace("/", ".")
            return self.parse_deadline(raw), True
        return None, False

    def collect_application_links(self, article, base_url: str) -> list[tuple[str, str]]:
        body_text = self.clean_text(article.get_text(" ", strip=True))
        seen_urls: set[str] = set()
        pairs: list[tuple[str, str]] = []

        for label, raw_url in re.findall(r"([^:]{2,120}):\s*(https?://\S+)", body_text):
            url = raw_url.rstrip(").,;")
            if any(domain in url.lower() for domain in self.BLOCKED_EXTERNAL_DOMAINS):
                continue
            if url in seen_urls:
                continue
            seen_urls.add(url)
            pairs.append((self.clean_text(label), url))

        if pairs:
            return pairs

        for anchor in article.select("a[href]"):
            href = (anchor.get("href") or "").strip()
            if not href:
                continue
            absolute = urljoin(base_url, href)
            lowered = absolute.lower()
            if any(domain in lowered for domain in self.BLOCKED_EXTERNAL_DOMAINS):
                continue
            if not lowered.startswith("http"):
                continue
            if absolute in seen_urls:
                continue
            seen_urls.add(absolute)
            label = self.clean_text(anchor.get_text(" ", strip=True))
            pairs.append((label, absolute))

        return pairs

    def infer_title_and_company(self, page_title: str, link_label: str) -> tuple[str, str]:
        base = self.clean_text(page_title)
        candidate = self.clean_text(link_label) or base
        normalized_candidate = self.normalize_turkish(candidate)
        if (
            not candidate
            or len(candidate) > 90
            or any(
                phrase in normalized_candidate
                for phrase in (
                    "tiklayiniz",
                    "tikla",
                    "bize katil",
                    "detayli bilgi ve basvuru icin",
                    "basvuru icin hemen",
                )
            )
        ):
            candidate = base

        title = candidate
        company = ""

        for separator in (" – ", " - "):
            if separator in candidate:
                company, rest = [part.strip() for part in candidate.split(separator, 1)]
                title = candidate
                if rest:
                    return title, company

        if " – " in base:
            company = base.split(" – ", 1)[0].strip()
        elif " - " in base:
            company = base.split(" - ", 1)[0].strip()
        else:
            company_match = re.match(
                r"(.+?)(?=\s+(?:staj programi|staj basvurulari|future talent|internship program|talent camp|uzun donem|is firsatlari|take-off|programi))",
                self.normalize_turkish(base),
                re.I,
            )
            if company_match:
                company = self.clean_text(base[: len(company_match.group(1))])

        return title, company

    def parse_detail(self, response):
        soup = BeautifulSoup(response.text, "html.parser")
        page_title = self.clean_text(
            response.css("h1.entry-title::text, h1::text").get("")
            or (soup.title.get_text(" ", strip=True) if soup.title else "")
        )
        page_title = page_title.replace(" – YTÜ Öğrenci Rehberlik ve Kariyer Merkezi", "").strip()
        article = soup.select_one(".entry-content") or soup.select_one("article") or soup
        description = self.clean_text(article.get_text(" ", strip=True))[:4000]
        deadline, has_deadline = self.extract_deadline(description)
        application_links = self.collect_application_links(article, response.url)
        if deadline is None and application_links:
            deadline = extract_deadline_from_remote_page(self, application_links[0][1])
        if has_deadline and deadline is None:
            self.logger.info("YTU_ORKAM_SKIPPED_EXPIRED: %s", page_title)
            return

        if not application_links:
            return

        multiple_links = len(application_links) > 1

        for index, (label, application_url) in enumerate(application_links, start=1):
            title, company = self.infer_title_and_company(page_title, label)
            if not has_listing_keywords(self, title, description):
                continue

            source_url = response.url if not multiple_links else f"{response.url}#link-{index}"
            logo_url = fetch_remote_logo_url(application_url, company_name=company)

            yield ScrapedListingItem(
                title=title,
                company_name=company or "YTU ORKAM Ilani",
                company_logo_url=logo_url,
                source_url=source_url,
                application_url=application_url,
                source_platform="ytu_orkam",
                em_focus_area=self.detect_em_focus_area(title, description, company),
                internship_type=self.detect_internship_type(title, description),
                company_origin=self.detect_company_origin(company),
                location="Turkiye",
                description=description,
                requirements="",
                application_deadline=deadline,
                deadline_status=self.compute_deadline_status(deadline),
                is_active=deadline is None or deadline >= date.today(),
                is_talent_program="program" in self.normalize_turkish(f"{title} {description}"),
                program_type=self.detect_program_type(title, description),
                duration_weeks=None,
                scraped_at=datetime.utcnow(),
            )


class SavunmaSpider(BaseEMSpider):
    name = "savunma"
    API_URL = "https://savunmakariyer.com/api/career-core/public/jobs"
    SAVUNMA_PROGRAM_KEYWORDS = (
        "staj programi",
        "staj program",
        "yaz staji",
        "yaz staj",
        "discover program",
        "discover",
        "intern program",
        "internship program",
        "stage 2026",
        "prizma staj programi",
        "hit yaz staj programi",
        "sky discover",
        "as takimi yaz staj programi",
        "kariyerini ucur yaz staj programi",
        "a yetenek yaz staji",
        "a yetenek yaz staji 2026 lisans",
        "a yetenek",
        "program hakkinda",
        "gelecegi savunmak icin birlikteyiz",
    )
    SAVUNMA_STUDENT_KEYWORDS = (
        "staj",
        "intern",
        "internship",
        "discover",
        "yetenek",
        "lisans",
        "undergraduate",
        "ogrenci",
        "summer",
    )

    MAX_PAGES = 10

    def start_requests(self):
        payload = {
            "page": 1,
            "size": 100,
            "sortDirection": "DESC",
        }
        yield Request(
            self.API_URL,
            method="POST",
            body=json.dumps(payload),
            headers={"Content-Type": "application/json"},
            callback=self.parse,
            meta={"page": 1},
        )

    def should_include_item(self, title: str, description: str) -> bool:
        normalized_title = self.normalize_turkish(title)
        normalized_description = self.normalize_turkish(description)
        normalized = f"{normalized_title} {normalized_description}"
        has_program_signal = any(keyword in normalized for keyword in self.SAVUNMA_PROGRAM_KEYWORDS)
        has_title_student_signal = any(keyword in normalized_title for keyword in self.SAVUNMA_STUDENT_KEYWORDS)
        if "on lisans" in normalized or "onlisans" in normalized:
            return False
        return has_program_signal or has_title_student_signal

    def parse(self, response):
        payload = json.loads(response.text)
        data = payload.get("data") or {}
        items = data.get("content") or data.get("contents") or data.get("data") or []

        current_page = response.meta.get("page", 1)
        total_pages = data.get("totalPages", 1)
        self.logger.info("SAVUNMA_PAGE_%s_OF_%s: %s items", current_page, total_pages, len(items))

        if current_page < min(total_pages, self.MAX_PAGES):
            next_page = current_page + 1
            next_payload = {
                "page": next_page,
                "size": 100,
                "sortDirection": "DESC",
            }
            yield Request(
                self.API_URL,
                method="POST",
                body=json.dumps(next_payload),
                headers={"Content-Type": "application/json"},
                callback=self.parse,
                meta={"page": next_page},
                dont_filter=True,
            )

        for item in items:
            if not item.get("visible") or item.get("jobStatus") != "PUBLISHED":
                continue

            title = self.clean_text(item.get("jobTitle", ""))
            description = self.clean_text(item.get("jobDescription", ""))
            company = self.clean_text(item.get("companyName", ""))
            if not self.should_include_item(title, description):
                continue
            deadline = self.parse_deadline((item.get("endDate") or "")[:10])
            if deadline is None:
                self.logger.info("SAVUNMA_SKIPPED_MISSING_OR_EXPIRED_DEADLINE: %s", title)
                continue
            source_url = f"https://savunmakariyer.com/api/career-core/public/job/{item.get('id')}"

            yield ScrapedListingItem(
                title=title,
                company_name=company,
                company_logo_url=absolute_logo("https://savunmakariyer.com", item.get("companyLogo")),
                source_url=source_url,
                source_platform="savunma",
                em_focus_area="savunma_havacilik_enerji",
                internship_type=self.detect_internship_type(title, description),
                company_origin=self.detect_company_origin(company),
                location=self.clean_text(item.get("jobLocation", "Turkiye")),
                description=description,
                requirements="",
                application_deadline=deadline,
                deadline_status=self.compute_deadline_status(deadline),
                is_active=deadline is None or deadline >= date.today(),
                is_talent_program="program" in self.normalize_turkish(f"{title} {description}"),
                program_type=self.detect_program_type(title, description),
                duration_weeks=None,
                scraped_at=datetime.utcnow(),
            )
