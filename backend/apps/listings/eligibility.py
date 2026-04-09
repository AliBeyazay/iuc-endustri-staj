import re
import unicodedata
from dataclasses import dataclass


_TR_CHAR_MAP = str.maketrans(
    {
        "C": "c",
        "G": "g",
        "I": "i",
        "O": "o",
        "S": "s",
        "U": "u",
        "\u00c7": "c",
        "\u00e7": "c",
        "\u011e": "g",
        "\u011f": "g",
        "\u0130": "i",
        "\u0131": "i",
        "\u00d6": "o",
        "\u00f6": "o",
        "\u015e": "s",
        "\u015f": "s",
        "\u00dc": "u",
        "\u00fc": "u",
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

_EXPERIENCE_REQUIRED_PATTERNS = (
    (
        "minimum_years_experience_tr",
        re.compile(r"\b(?:en\s+az|minimum)\s+([2-9]|[1-9][0-9])\s+yil\s+(?:tecrube|deneyim)\b"),
    ),
    (
        "years_experience_range_tr",
        re.compile(
            r"\b([2-9]|[1-9][0-9])\s*(?:[-–]|\s)\s*([2-9]|[1-9][0-9])\s+yil\s+deneyimli\b"
        ),
    ),
    (
        "minimum_years_experience_en",
        re.compile(
            r"\b(?:at\s+least|min(?:imum)?(?:\s+of)?)\s+([2-9]|[1-9][0-9])\+?\s+years?\s+"
            r"(?:of\s+)?(?:professional\s+)?experience\b"
        ),
    ),
    (
        "years_experience_range_en",
        re.compile(
            r"\b([1-9]|[1-9][0-9])\s*(?:[-–]|\s)\s*([1-9]|[1-9][0-9])\s+years?\s+"
            r"(?:(?:working|relevant|industry|professional)\s+)?experience\b"
        ),
    ),
    (
        "experienced_role_tr",
        re.compile(r"\b(?:tercihen\s+)?([2-9]|[1-9][0-9])\+?\s+yil\s+tecrube\s+sahibi\b"),
    ),
)


@dataclass(frozen=True, slots=True)
class EligibilityDecision:
    graduate_only: bool
    requires_experience: bool = False
    reason: str | None = None

    @property
    def is_eligible_for_students(self) -> bool:
        return not self.graduate_only and not self.requires_experience


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

    for reason, pattern in _EXPERIENCE_REQUIRED_PATTERNS:
        match = pattern.search(combined)
        if not match:
            continue

        numbers = [int(value) for value in match.groups() if value is not None]
        if not numbers:
            continue

        if len(numbers) == 1 and numbers[0] < 2:
            continue

        if len(numbers) > 1 and max(numbers) < 2:
            continue

        return EligibilityDecision(
            graduate_only=False,
            requires_experience=True,
            reason=reason,
        )

    return EligibilityDecision(graduate_only=False)
