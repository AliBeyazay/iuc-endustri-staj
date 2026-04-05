import argparse
import random
import re
import time
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE_URL = "https://www.youthall.com/tr/companies/all?page={}"
TOTAL_PAGES = 108
DEFAULT_OUTPUT_FILE = "youthall_sirketler.txt"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

BLOCKED_SLUGS = {
    "companies",
    "ilanlar",
    "etkinlikler",
    "ayricaliklar",
    "egitimler",
    "blog",
    "okullar",
    "ogrenci-kulupleri",
    "universiteler",
    "liseler",
    "giris",
    "kayit",
    "kullanici-girisi",
    "sirketler-icin",
    "kariyer",
    "yardim",
    "ebook",
    "hakkimizda",
    "iletisime-gecin",
    "iletisim",
    "ucretsiz-kayit-ol",
    "premium-uyelik",
}

BLOCKED_NAMES = {
    "sirketleri kesfet",
    "tum sirketler",
    "giris yap",
    "okullar",
    "sirketler",
    "ilanlar",
    "etkinlikler",
    "ayricaliklar",
    "egitimler",
    "blog",
    "kayit ol",
    "kullanici girisi",
    "daha fazla sirketi incele",
    "takip et",
    "turkce",
    "ingilizce",
    "tr",
}


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def normalize_lookup(value: str) -> str:
    value = normalize_whitespace(value).casefold()
    translation_table = str.maketrans({
        "\u00e7": "c",
        "\u011f": "g",
        "\u0131": "i",
        "\u00f6": "o",
        "\u015f": "s",
        "\u00fc": "u",
    })
    return value.translate(translation_table)


def clean_company_name(raw_name: str) -> str:
    return normalize_whitespace((raw_name or "").replace("Youthall Verified Badge", " "))


def is_company_profile_href(href: str) -> bool:
    if not href:
        return False

    parsed = urlparse(href)
    if parsed.netloc and "youthall.com" not in parsed.netloc.casefold():
        return False

    path = (parsed.path or "").strip().rstrip("/")
    if not path:
        return False

    segments = [segment for segment in path.split("/") if segment]
    if len(segments) != 2 or segments[0] != "tr":
        return False

    return segments[1].casefold() not in BLOCKED_SLUGS


def is_valid_company_name(name: str) -> bool:
    normalized = normalize_lookup(name)
    if not normalized or normalized in BLOCKED_NAMES:
        return False
    if normalized.isdigit():
        return False
    return True


def extract_company_names_from_html(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    names: list[str] = []

    for heading in soup.select("h3"):
        anchor = heading.find_parent("a", href=True)
        if not anchor or not is_company_profile_href(anchor["href"]):
            continue

        name = clean_company_name(heading.get_text(separator=" ", strip=True))
        if not is_valid_company_name(name):
            continue

        names.append(name)

    return names


def dedupe_company_names(names: list[str]) -> list[str]:
    unique_names: list[str] = []
    seen: set[str] = set()

    for name in names:
        key = normalize_lookup(name)
        if not key or key in seen:
            continue
        seen.add(key)
        unique_names.append(normalize_whitespace(name))

    return unique_names


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(HEADERS)

    retry = Retry(
        total=3,
        read=3,
        connect=3,
        backoff_factor=1,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


def scrape_page(page_num: int, *, session: requests.Session, timeout: float = 15.0) -> list[str]:
    response = session.get(BASE_URL.format(page_num), timeout=timeout)
    response.raise_for_status()
    response.encoding = response.apparent_encoding or "utf-8"
    return extract_company_names_from_html(response.text)


def write_company_names(names: list[str], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(names) + ("\n" if names else ""), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Youthall sirket sayfalarindan benzersiz sirket isimlerini ceker."
    )
    parser.add_argument("--pages", type=int, default=TOTAL_PAGES, help="Taranacak toplam sayfa sayisi.")
    parser.add_argument("--timeout", type=float, default=15.0, help="Her istek icin timeout suresi.")
    parser.add_argument("--delay-min", type=float, default=0.8, help="Sayfalar arasi minimum bekleme.")
    parser.add_argument("--delay-max", type=float, default=1.0, help="Sayfalar arasi maksimum bekleme.")
    parser.add_argument(
        "--output",
        default=None,
        help="Cikti dosyasi yolu. Varsayilan olarak backend/youthall_sirketler.txt kullanilir.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    total_pages = max(1, min(args.pages, TOTAL_PAGES))
    delay_min = max(0.0, min(args.delay_min, args.delay_max))
    delay_max = max(delay_min, args.delay_max)
    output_path = Path(args.output) if args.output else Path(__file__).resolve().parents[2] / DEFAULT_OUTPUT_FILE

    session = build_session()
    all_names: list[str] = []
    pages_with_data = 0
    error_pages: list[int] = []

    print(f"Youthall sirket listesi cekiliyor ({total_pages} sayfa)...\n")

    for page_num in range(1, total_pages + 1):
        try:
            page_names = scrape_page(page_num, session=session, timeout=args.timeout)
        except requests.RequestException as exc:
            error_pages.append(page_num)
            print(f"  [HATA] Sayfa {page_num}: {exc}")
            continue

        if page_names:
            pages_with_data += 1

        before_count = len(all_names)
        all_names = dedupe_company_names(all_names + page_names)
        added_count = len(all_names) - before_count

        print(
            f"  Sayfa {page_num:>3}/{total_pages} - {len(page_names)} sirket "
            f"({len(all_names)} benzersiz, +{max(added_count, 0)} yeni)"
        )

        if page_num < total_pages:
            time.sleep(random.uniform(delay_min, delay_max))

    write_company_names(all_names, output_path)

    print("\nTamamlandi!")
    print(f"  Taranan sayfa: {total_pages}")
    print(f"  Veri alinan sayfa: {pages_with_data}")
    print(f"  Toplam benzersiz sirket: {len(all_names)}")
    print(f"  Cikti dosyasi: {output_path}")
    print(f"  Hata sayfalari: {', '.join(map(str, error_pages)) if error_pages else 'Yok'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
