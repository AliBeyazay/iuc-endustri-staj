import re
import unicodedata
from dataclasses import dataclass


_TR_CHAR_MAP = str.maketrans(
    {
        "c": "c",
        "C": "c",
        "g": "g",
        "G": "g",
        "i": "i",
        "I": "i",
        "o": "o",
        "O": "o",
        "s": "s",
        "S": "s",
        "u": "u",
        "U": "u",
        "ç": "c",
        "Ç": "c",
        "ğ": "g",
        "Ğ": "g",
        "ı": "i",
        "İ": "i",
        "ö": "o",
        "Ö": "o",
        "ş": "s",
        "Ş": "s",
        "ü": "u",
        "Ü": "u",
    }
)

_GRADUATE_ONLY_PATTERNS = (
    (
        "graduates_only",
        re.compile(r"\b(?:(?:fresh|recent|new)\s+)?graduates?\s+only\b"),
    ),
    (
        "only_open_to_graduates",
        re.compile(r"\bonly\s+open\s+to\s+(?:(?:fresh|recent|new)\s+)?graduates?\b"),
    ),
    (
        "only_for_graduates",
        re.compile(r"\bonly\s+(?:for|to)\s+(?:(?:fresh|recent|new)\s+)?graduates?\b"),
    ),
    (
        "students_not_considered",
        re.compile(
            r"\b(?:applications?\s+from\s+)?(?:current\s+)?students?\s+"
            r"(?:will\s+not\s+be\s+considered|are\s+not\s+considered|"
            r"will\s+not\s+be\s+accepted|are\s+not\s+eligible|"
            r"cannot\s+apply|can\s+not\s+apply|may\s+not\s+apply)\b"
        ),
    ),
    (
        "sadece_mezun",
        re.compile(r"\bsadece\s+(?:yeni\s+)?mezun(?:lar)?(?:\s+adaylar)?\b"),
    ),
    (
        "yalniz_mezun",
        re.compile(r"\byalniz(?:ca)?\s+(?:yeni\s+)?mezun(?:lar)?(?:\s+adaylar)?\b"),
    ),
    (
        "ogrenci_dislanmis",
        re.compile(
            r"\b(?:mevcut\s+)?ogrenciler?\s+"
            r"(?:degerlendirilmeyecek|kabul\s+edilmeyecek|basvuramaz|uygun\s+degil)\b"
        ),
    ),
)


@dataclass(frozen=True, slots=True)
class EligibilityDecision:
    graduate_only: bool
    reason: str | None = None


def normalize_eligibility_text(text: str | None) -> str:
    if not text:
        return ""

    normalized = str(text).translate(_TR_CHAR_MAP).casefold()
    normalized = unicodedata.normalize("NFKD", normalized)
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def classify_student_eligibility(title: str | None, description: str | None) -> EligibilityDecision:
    combined = normalize_eligibility_text(f"{title or ''} {description or ''}")
    if not combined:
        return EligibilityDecision(graduate_only=False)

    for reason, pattern in _GRADUATE_ONLY_PATTERNS:
        if pattern.search(combined):
            return EligibilityDecision(graduate_only=True, reason=reason)

    return EligibilityDecision(graduate_only=False)

