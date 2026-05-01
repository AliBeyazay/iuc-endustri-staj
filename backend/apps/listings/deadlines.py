import re
from datetime import date, timedelta
from html import unescape

import requests
from bs4 import BeautifulSoup

TR_CHAR_TRANSLATION = str.maketrans(
    {
        "c": "c",
        "g": "g",
        "i": "i",
        "o": "o",
        "s": "s",
        "u": "u",
        "C": "c",
        "G": "g",
        "I": "i",
        "O": "o",
        "S": "s",
        "U": "u",
        "ç": "c",
        "ğ": "g",
        "ı": "i",
        "ö": "o",
        "ş": "s",
        "ü": "u",
        "Ç": "c",
        "Ğ": "g",
        "İ": "i",
        "Ö": "o",
        "Ş": "s",
        "Ü": "u",
    }
)

TR_MONTHS = {
    "ocak": 1,
    "subat": 2,
    "mart": 3,
    "nisan": 4,
    "mayis": 5,
    "haziran": 6,
    "temmuz": 7,
    "agustos": 8,
    "eylul": 9,
    "ekim": 10,
    "kasim": 11,
    "aralik": 12,
}

EN_MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}

NORMALIZED_DATE_PATTERN = (
    r"\d{4}-\d{2}-\d{2}"
    r"|\d{1,2}[./-]\d{1,2}[./-]\d{4}"
    r"|\d{1,2}\s+[a-z]+\s+\d{4}"
    r"|[a-z]+\s+\d{1,2}(?:st|nd|rd|th)?,\s*\d{4}"
    r"|[a-z]+\s+\d{1,2}(?:st|nd|rd|th)?\s+\d{4}"
)

RAW_DATE_PATTERN = (
    r"\d{4}-\d{2}-\d{2}"
    r"|\d{1,2}[./-]\d{1,2}[./-]\d{4}"
    r"|\d{1,2}\s+[A-Za-z]+\s+\d{4}"
    r"|[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,\s*\d{4}"
    r"|[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?\s+\d{4}"
)

NORMALIZED_TEXT_PATTERNS = (
    rf"basvuru tarihi[:\s]+(?:\d{{1,2}}[./-]\d{{1,2}}[./-]\d{{4}}\s*[–-]\s*)?({NORMALIZED_DATE_PATTERN})",
    rf"(?:son basvuru|son basvuru tarihi|ilan bitis tarihi|basvuru son tarihi)[:\s]+({NORMALIZED_DATE_PATTERN})",
    rf"({NORMALIZED_DATE_PATTERN})\s+tarihine kadar\s+(?:basvur|kabul)",
)

RAW_TEXT_PATTERNS = (
    rf"(?:Application Deadline|Job Posting End Date|Deadline|Closing[- ]?[Dd]ate)[:\s]+({RAW_DATE_PATTERN})",
    rf"Last day to apply(?: is)?[:\s]+({RAW_DATE_PATTERN})",
    rf"Apply (?:till|by|before)[:\s]+({RAW_DATE_PATTERN})",
    rf"Closes?(?: on)?[:\s]+({RAW_DATE_PATTERN})",
    rf"Applications? (?:close|due)(?: by)?[:\s]+({RAW_DATE_PATTERN})",
)

NORMALIZED_SIGNAL_PATTERNS = (
    r"\bson basvuru(?: tarihi)?\b",
    r"\bbasvuru tarihi\b",
    r"\bilan bitis tarihi\b",
)

RAW_SIGNAL_PATTERNS = (
    r"\bapplication deadline\b",
    r"\bjob posting end date\b",
    r"\blast day to apply\b",
    r"\bapply till\b",
    r"\bdeadline\b",
)


def normalize_deadline_text(text: str) -> str:
    normalized = unescape(text or "").replace("\xa0", " ").replace("\r", " ")
    normalized = re.sub(r"\s+", " ", normalized).strip().lower()
    return normalized.translate(TR_CHAR_TRANSLATION)


def _coerce_deadline(parsed: date, *, allow_past: bool) -> date | None:
    if allow_past or parsed >= date.today():
        return parsed
    return None


def parse_deadline_string(raw: str | None, *, allow_past: bool = False) -> date | None:
    if not raw:
        return None

    today = date.today()
    raw = unescape(str(raw)).replace("\xa0", " ").strip().rstrip(".,;)")
    raw = re.sub(r"\b(\d{1,2})(st|nd|rd|th)\b", r"\1", raw, flags=re.I)
    norm = normalize_deadline_text(raw)

    if norm in ("bugun", "today", "bugun son gun"):
        return today

    if re.search(r"\d+\s*(gun once|days ago)", norm):
        return None
    if "30+" in norm and "once" in norm:
        return None

    relative_match = re.search(r"(\d+)\s*(gun kaldi|days left|days remaining)", norm)
    if relative_match:
        return today + timedelta(days=int(relative_match.group(1)))

    iso_match = re.match(r"(\d{4})-(\d{2})-(\d{2})", raw)
    if iso_match:
        try:
            return _coerce_deadline(
                date(int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))),
                allow_past=allow_past,
            )
        except ValueError:
            return None

    dot_match = re.match(r"(\d{1,2})[./-](\d{1,2})[./-](\d{4})", raw)
    if dot_match:
        try:
            return _coerce_deadline(
                date(int(dot_match.group(3)), int(dot_match.group(2)), int(dot_match.group(1))),
                allow_past=allow_past,
            )
        except ValueError:
            return None

    day_month_year_match = re.search(r"(\d{1,2})\s+([a-z]+)\s+(\d{4})", norm)
    if day_month_year_match:
        month_num = TR_MONTHS.get(day_month_year_match.group(2)) or EN_MONTHS.get(day_month_year_match.group(2))
        if month_num:
            try:
                return _coerce_deadline(
                    date(int(day_month_year_match.group(3)), month_num, int(day_month_year_match.group(1))),
                    allow_past=allow_past,
                )
            except ValueError:
                return None

    month_day_year_match = re.search(r"([a-z]+)\s+(\d{1,2}),\s*(\d{4})", norm)
    if month_day_year_match:
        month_num = EN_MONTHS.get(month_day_year_match.group(1))
        if month_num:
            try:
                return _coerce_deadline(
                    date(int(month_day_year_match.group(3)), month_num, int(month_day_year_match.group(2))),
                    allow_past=allow_past,
                )
            except ValueError:
                return None

    month_day_year_no_comma_match = re.search(r"([a-z]+)\s+(\d{1,2})\s+(\d{4})", norm)
    if month_day_year_no_comma_match:
        month_num = EN_MONTHS.get(month_day_year_no_comma_match.group(1))
        if month_num:
            try:
                return _coerce_deadline(
                    date(
                        int(month_day_year_no_comma_match.group(3)),
                        month_num,
                        int(month_day_year_no_comma_match.group(2)),
                    ),
                    allow_past=allow_past,
                )
            except ValueError:
                return None

    return None


def has_deadline_signal(text: str) -> bool:
    raw = unescape(text or "")
    normalized = normalize_deadline_text(raw)
    return any(re.search(pattern, normalized, re.I) for pattern in NORMALIZED_SIGNAL_PATTERNS) or any(
        re.search(pattern, raw, re.I) for pattern in RAW_SIGNAL_PATTERNS
    )


def extract_deadline_from_text(text: str, *, allow_past: bool = False) -> date | None:
    raw = unescape(text or "").replace("\xa0", " ")
    normalized = normalize_deadline_text(raw)

    for pattern in NORMALIZED_TEXT_PATTERNS:
        match = re.search(pattern, normalized, re.I)
        if match:
            deadline = parse_deadline_string(match.group(1), allow_past=allow_past)
            if deadline is not None:
                return deadline

    for pattern in RAW_TEXT_PATTERNS:
        match = re.search(pattern, raw, re.I)
        if match:
            deadline = parse_deadline_string(match.group(1), allow_past=allow_past)
            if deadline is not None:
                return deadline

    return None


def fetch_remote_html(url: str, *, timeout: int = 10) -> str:
    if not url:
        return ""

    try:
        response = requests.get(
            url,
            timeout=timeout,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
                )
            },
        )
        response.raise_for_status()
        response.encoding = response.encoding or "utf-8"
        return response.text or ""
    except Exception:
        return ""


def extract_deadline_from_html(html: str, *, allow_past: bool = False) -> date | None:
    if not html:
        return None

    schema_match = re.search(r'"validThrough"\s*:\s*"([^"]+)"', html)
    if schema_match:
        deadline = parse_deadline_string(schema_match.group(1)[:10], allow_past=allow_past)
        if deadline is not None:
            return deadline

    text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
    deadline = extract_deadline_from_text(text, allow_past=allow_past)
    if deadline is not None:
        return deadline

    generic_match = re.search(r"(\d{4}-\d{2}-\d{2})", html)
    if generic_match:
        return parse_deadline_string(generic_match.group(1), allow_past=allow_past)

    return None


def extract_deadline_from_remote_page(
    url: str,
    *,
    allow_past: bool = False,
    html_cache: dict[str, str] | None = None,
) -> date | None:
    if not url:
        return None

    html = None
    if html_cache is not None:
        html = html_cache.get(url)

    if html is None:
        html = fetch_remote_html(url)
        if html_cache is not None:
            html_cache[url] = html

    return extract_deadline_from_html(html, allow_past=allow_past)
