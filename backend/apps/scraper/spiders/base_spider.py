import re
import unicodedata
from datetime import date, timedelta, datetime
from typing import Optional

import scrapy


class BaseEMSpider(scrapy.Spider):
    """
    Shared logic for all IUC internship spiders.
    Handles keyword filtering, sector detection, date parsing,
    deadline validation and common field extraction.
    """

    name = "base_em"

    TR_KEYWORDS = [
        "endustri muhendisi", "endustri muhendisligi", "stajyer", "staj",
        "uretim planlama", "tedarik zinciri", "kalite yonetimi",
        "yalin uretim", "proje yonetimi", "veri analitigi", "operasyon",
        "lojistik", "imalat", "otomotiv", "savunma", "havacilik",
    ]
    EN_KEYWORDS = [
        "industrial engineering", "industrial engineer", "intern", "internship",
        "supply chain", "quality management", "lean manufacturing",
        "production planning", "project management", "operations",
        "logistics", "manufacturing", "automotive", "defence", "defense",
    ]

    EM_SECTOR_RULES = {
        "imalat_metal_makine": {
            "positive": [
                "imalat", "metal", "makine", "mekanik", "manufacturing",
                "cnc", "kaynak", "dokum", "sac", "pres", "mekatronik",
                "fabrika", "plant", "uretim hatti",
            ],
            "negative": ["banka", "finance", "software", "pharma", "hospital"],
        },
        "otomotiv_yan_sanayi": {
            "positive": [
                "otomotiv", "automotive", "arac", "yan sanayi", "oem",
                "tier-1", "tier 1", "ford", "tofas", "oyak", "fiat",
                "renault", "toyota", "honda", "bosch", "valeo",
            ],
            "negative": ["banka", "retail", "pharma", "hospital"],
        },
        "yazilim_bilisim_teknoloji": {
            "positive": [
                "yazilim", "software", "bilisim", "teknoloji", "data",
                "veri", "analitik", "analytics", "python", "java", "sql",
                "erp", "sap", "dijital", "digital", "siber", "yapay zeka",
                "ai", "developer", "cloud", "frontend", "backend",
            ],
            "negative": ["uretim hatti", "pharma lab", "hastane"],
        },
        "hizmet_finans_danismanlik": {
            "positive": [
                "finans", "finance", "danismanlik", "consulting", "banka",
                "bank", "sigorta", "insurance", "muhasebe", "denetim",
                "audit", "yatirim", "investment", "treasury", "risk",
            ],
            "negative": ["food", "pharma", "otomotiv", "manufacturing"],
        },
        "eticaret_perakende_fmcg": {
            "positive": [
                "e-ticaret", "ecommerce", "perakende", "retail", "fmcg",
                "hizli tuketim", "consumer goods", "marketing",
                "category", "brand", "merchandising",
            ],
            "negative": ["banka", "pharma", "savunma", "automotive"],
        },
        "savunma_havacilik_enerji": {
            "positive": [
                "savunma", "defence", "defense", "havacilik", "aerospace",
                "enerji", "energy", "nukleer", "yenilenebilir", "aviation",
                "space", "aircraft",
            ],
            "negative": ["retail", "bank", "pharma"],
        },
        "gida_kimya_saglik": {
            "positive": [
                "gida", "food", "kimya", "chemistry", "saglik", "health",
                "ilac", "pharma", "biyoteknoloji", "biotech",
                "laboratuvar", "laboratory", "lab", "medikal",
                "hastane", "hospital", "klinik", "clinical",
            ],
            "negative": ["banka", "software", "otomotiv", "automotive"],
        },
        "lojistik_tasimacilık": {
            "positive": [
                "lojistik", "logistics", "tasimacilik", "nakliye", "depo",
                "warehouse", "freight", "gumruk", "kargo", "dagitim",
                "teslimat", "shipment", "supply chain",
            ],
            "negative": ["pharma", "bank", "software"],
        },
        "tekstil_moda": {
            "positive": [
                "tekstil", "textile", "moda", "fashion", "kumas",
                "konfeksiyon", "giyim", "iplik", "apparel",
            ],
            "negative": ["bank", "software", "pharma"],
        },
        "insaat_yapi_malzemeleri": {
            "positive": [
                "insaat", "construction", "yapi", "bina", "altyapi",
                "infrastructure", "beton", "cimento", "seramik", "tesisat",
            ],
            "negative": ["bank", "software", "pharma"],
        },
    }

    COMPANY_SECTOR_HINTS = {
        "imalat_metal_makine": [
            "borusan holding", "bsh ev aletleri", "schneider electric",
            "sisecam", "kordsa", "beko", "koc holding", "zorlu holding",
            "dogan holding",
        ],
        "otomotiv_yan_sanayi": [
            "borusan otomotiv", "toyota turkiye", "bosch", "turktraktor",
            "mercedes-benz otomotiv", "mercedes benz otomotiv", "tofas",
            "togg", "otokoc otomotiv", "ford otosan", "otokar",
            "mercedes-benz turk", "mercedes benz turk", "oyak-renault",
            "oyak renault", "dogus otomotiv", "volkswagen", "seat", "porsche",
        ],
        "yazilim_bilisim_teknoloji": [
            "turk telekom grubu", "amazon", "softtech", "sap", "microsoft",
            "vodafone", "paribu", "oracle", "intel", "hepsiburada",
            "hepsiburada.com", "sahibinden", "sahibinden.com", "ibm",
            "turkcell", "huawei", "getir", "trendyol", "google", "apple",
            "samsung", "iyzico", "garanti bbva teknoloji", "intertech",
            "yemeksepeti", "yemeksepeti.com",
        ],
        "hizmet_finans_danismanlik": [
            "kuveyt turk katilim bankasi", "kpmg", "ing", "mckinsey",
            "mckinsey & company", "turkiye is bankasi", "boston consulting group",
            "bcg", "hsbc", "garanti bbva", "turkiye finans katilim bankasi",
            "ziraat bankasi", "teb", "teb bnp paribas", "yapi kredi bankasi",
            "pwc", "pricewaterhousecoopers", "deloitte", "fiba grubu",
            "turkiye sigorta", "allianz", "qnb", "halkbank", "denizbank",
            "akbank", "ey", "ernst & young", "merkez bankasi",
        ],
        "eticaret_perakende_fmcg": [
            "migros", "turk tuborg", "boyner", "eti", "mey diageo",
            "diageo turkiye", "procter & gamble", "procter gamble", "p&g",
            "colgate-palmolive", "colgate palmolive", "philip morris turkey",
            "h&m", "pernod ricard", "ikea", "metro turkiye", "mavi",
            "l'oreal", "loreal", "red bull", "yildiz holding",
            "anadolu grubu", "mondelez international", "mondelez",
            "unilever", "starbucks", "danone", "lc waikiki",
            "the coca-cola company", "coca-cola company", "pepsico",
            "british american tobacco", "bat", "anadolu efes", "jti",
            "japan tobacco international", "pladis", "ulker",
            "coca-cola icecek", "coca cola icecek", "cci", "nestle", "penti",
        ],
        "savunma_havacilik_enerji": [
            "tei", "turk havacilik ve uzay sanayii", "tusas", "fnss", "stm",
            "baykar", "aselsan", "havelsan", "roketsan", "pegasus",
            "turk hava yollari", "thy", "tav havalimanlari", "enerjisa enerji",
            "enerjisa", "petrol ofisi", "siemens", "socar turkiye",
            "tupras", "kale grubu", "tubitak",
        ],
        "gida_kimya_saglik": [
            "sanofi", "johnson & johnson", "johnson johnson", "abdi ibrahim",
            "novartis", "bilim ilac", "pfizer", "henkel", "astrazeneca",
            "bayer", "nobel ilac", "roche",
        ],
        "lojistik_tasimacilık": ["dhl group"],
        "tekstil_moda": ["penti"],
        "insaat_yapi_malzemeleri": ["cimsa", "eczacibasi toplulugu"],
    }

    SECTOR_SCORE_WEIGHTS = {
        "title_positive": 5,
        "company_positive": 3,
        "description_positive": 1,
        "company_hint": 8,
        "title_company_hint": 4,
        "title_negative": -4,
        "company_negative": -3,
        "description_negative": -2,
    }

    SOURCE_WEIGHT_ADJUSTMENTS = {
        "linkedin": {"title_positive": 6, "description_positive": 1, "company_positive": 3},
        "youthall": {"title_positive": 4, "description_positive": 2, "company_positive": 3},
        "anbea": {"title_positive": 4, "description_positive": 2, "company_positive": 3},
        "boomerang": {"title_positive": 5, "description_positive": 2, "company_positive": 3},
        "toptalent": {"title_positive": 5, "description_positive": 2, "company_positive": 3},
        "odtu_kpm": {"title_positive": 4, "description_positive": 3, "company_positive": 3},
        "bogazici_km": {"title_positive": 4, "description_positive": 3, "company_positive": 3},
        "ytu_orkam": {"title_positive": 4, "description_positive": 3, "company_positive": 3},
        "itu_kariyer": {"title_positive": 3, "description_positive": 3, "company_positive": 4},
        "kariyer": {"title_positive": 5, "description_positive": 1, "company_positive": 3},
        "savunma": {"title_positive": 6, "description_positive": 2, "company_positive": 4},
    }

    KNOWN_TURKISH_COMPANIES = [
        "ford otosan", "tofas", "arcelik", "vestel", "turk telekom",
        "turkcell", "bim", "migros", "sabanci", "koc", "enka", "tekfen",
        "aselsan", "roketsan", "havelsan", "tubitak", "baykar", "tusas",
        "otokar", "temsa", "logo yazilim", "karel", "zorlu", "ekol",
    ]

    TURKIYE_LOCATION_KEYWORDS = [
        "turkiye", "turkey", "istanbul", "ankara", "izmir", "bursa", "kocaeli",
        "gebze", "sakarya", "eskisehir", "antalya", "konya", "tekirdag",
        "manisa", "denizli", "adana", "mersin", "kayseri", "gaziantep",
        "balikesir", "samsun", "trabzon", "edirne", "corlu", "yalova",
        "izmit", "pendik", "tuzla", "kartal", "umraniye", "maltepe",
        "dudullu", "dilovasi", "cayirova", "aliaga", "bornova", "torbali",
        "eyup", "levent", "maslak", "besiktas", "sisli", "bakirkoy",
        "atasehir", "kagithane", "arnavutkoy", "sariyer",
    ]

    FOREIGN_LOCATION_KEYWORDS = [
        "united states", "birlesik devletler", "abd", "u.s.", "usa",
        "germany", "almanya", "poland", "hollanda", "netherlands",
        "france", "italy", "spain", "uk", "united kingdom", "ingiltere",
        "canada", "mexico", "india", "romania", "czechia", "slovakia",
        "hungary", "belgium", "austria", "switzerland", "portugal",
        "pennsylvania", "cranberry township", "new york", "london",
        "berlin", "paris", "milan", "warsaw", "bucharest", "prague",
    ]

    REMOTE_LOCATION_KEYWORDS = [
        "remote", "uzaktan", "hybrid", "hibrit",
    ]

    PROGRAM_TYPE_RULES = {
        "yaz_staj_programi": ["yaz ", "summer", "yaz staj", "yaz donemi"],
        "rotasyon": ["rotasyon", "rotation"],
        "graduate_program": ["graduate", "mezun", "yeni mezun"],
        "akademi_bootcamp": ["akademi", "bootcamp", "camp", "okulu"],
    }

    TR_CHAR_MAP = str.maketrans({
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
    })

    def normalize_turkish(self, text: str) -> str:
        if not text:
            return ""
        text = str(text).translate(self.TR_CHAR_MAP).lower()
        text = unicodedata.normalize("NFKD", text)
        text = "".join(ch for ch in text if not unicodedata.combining(ch))
        return re.sub(r"\s+", " ", text).strip()

    def clean_text(self, text: str) -> str:
        if not text:
            return ""
        text = re.sub(r"<[^>]+>", " ", text)
        text = text.replace("\xa0", " ")
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def normalize_location(self, text: str) -> str:
        return self.clean_text(text or "")

    def contains_any_keyword(self, text: str, keywords: list[str]) -> bool:
        normalized = self.normalize_turkish(text or "")
        return any(self.normalize_turkish(keyword) in normalized for keyword in keywords)

    def is_turkiye_location(self, location: str) -> bool:
        normalized = self.normalize_turkish(self.normalize_location(location))
        if not normalized:
            return False
        if any(keyword in normalized for keyword in self.FOREIGN_LOCATION_KEYWORDS):
            return False
        return any(keyword in normalized for keyword in self.TURKIYE_LOCATION_KEYWORDS)

    def is_remote_or_hybrid_location(self, location: str) -> bool:
        return self.contains_any_keyword(self.normalize_location(location), self.REMOTE_LOCATION_KEYWORDS)

    def has_turkiye_context(self, location: str, description: str = "", company_name: str = "") -> bool:
        if self.is_turkiye_location(location):
            return True

        normalized_description = self.normalize_turkish(description or "")
        normalized_company = self.normalize_turkish(company_name or "")
        company_hints = set(self.KNOWN_TURKISH_COMPANIES)
        for hints in self.COMPANY_SECTOR_HINTS.values():
            company_hints.update(hints)

        has_turkiye_keyword = any(keyword in normalized_description for keyword in self.TURKIYE_LOCATION_KEYWORDS)
        has_known_turkish_company = any(
            self.normalize_turkish(company_hint) in normalized_company
            for company_hint in company_hints
        )

        if has_turkiye_keyword or has_known_turkish_company:
            return True

        if any(keyword in normalized_description for keyword in self.FOREIGN_LOCATION_KEYWORDS):
            return False

        return False

    def filter_by_keywords(self, title: str, description: str) -> bool:
        combined = self.normalize_turkish(f"{title} {description}")
        all_kw = [
            "endustri muhendisi",
            "endustri muhendisligi",
            "uretim planlama",
            "tedarik zinciri",
            "kalite yonetimi",
            "yalin uretim",
            "proje yonetimi",
            "veri analitigi",
            "operasyon",
            "lojistik",
            "imalat",
            "otomotiv",
            "savunma",
            "havacilik",
            "industrial engineering",
            "industrial engineer",
            "supply chain",
            "quality management",
            "lean manufacturing",
            "production planning",
            "project management",
            "operations",
            "logistics",
            "manufacturing",
            "automotive",
            "defence",
            "defense",
        ]
        return any(self.normalize_turkish(kw) in combined for kw in all_kw)

    def targets_associate_degree(self, title: str, description: str) -> bool:
        text = self.normalize_turkish(f"{title} {description}")
        associate_keywords = [
            "onlisans", "on lisans", "associate degree", "vocational school",
            "meslek yuksekokulu", "meslek yuksek okulu", "myo", "2 yillik", "iki yillik",
        ]
        bachelor_keywords = [
            "lisans", "4 yillik", "dort yillik", "undergraduate", "bachelor",
            "muhendislik", "3. sinif", "4. sinif", "universite ogrencisi",
        ]
        has_associate_signal = any(keyword in text for keyword in associate_keywords)
        has_bachelor_signal = any(keyword in text for keyword in bachelor_keywords)
        return has_associate_signal and not has_bachelor_signal

    def get_sector_classification(
        self,
        title: str,
        description: str,
        company_name: str = "",
        source_platform: str = "",
    ) -> dict:
        normalized_title = self.normalize_turkish(title or "")
        normalized_description = self.normalize_turkish(description or "")
        normalized_company = self.normalize_turkish(company_name or "")
        weights = {**self.SECTOR_SCORE_WEIGHTS, **self.SOURCE_WEIGHT_ADJUSTMENTS.get(source_platform, {})}

        scores = {}

        for sector, rules in self.EM_SECTOR_RULES.items():
            score = 0

            for keyword in rules.get("positive", []):
                normalized_keyword = self.normalize_turkish(keyword)
                if normalized_keyword in normalized_title:
                    score += weights["title_positive"]
                if normalized_keyword in normalized_company:
                    score += weights["company_positive"]
                if normalized_keyword in normalized_description:
                    score += weights["description_positive"]

            for keyword in rules.get("negative", []):
                normalized_keyword = self.normalize_turkish(keyword)
                if normalized_keyword in normalized_title:
                    score += weights["title_negative"]
                if normalized_keyword in normalized_company:
                    score += weights["company_negative"]
                if normalized_keyword in normalized_description:
                    score += weights["description_negative"]

            for company_hint in self.COMPANY_SECTOR_HINTS.get(sector, []):
                normalized_hint = self.normalize_turkish(company_hint)
                if normalized_hint in normalized_company:
                    score += weights["company_hint"]
                elif normalized_hint in normalized_title:
                    score += weights["title_company_hint"]

            scores[sector] = score

        if not scores:
            return {"primary": "diger", "secondary": None, "confidence": 0.0, "scores": {}}

        best_sector, best_score = max(scores.items(), key=lambda item: item[1])
        sorted_scores = sorted(scores.values(), reverse=True)
        second_best_score = sorted_scores[1] if len(sorted_scores) > 1 else 0
        second_sector = None
        if len(sorted_scores) > 1:
            for sector, score in scores.items():
                if sector != best_sector and score == second_best_score:
                    second_sector = sector
                    break

        confidence = 0.0
        if best_score > 0:
            confidence = round(
                max(0.0, min(100.0, ((best_score - second_best_score) / max(best_score, 1)) * 100)),
                2,
            )

        primary = best_sector
        secondary = second_sector if second_sector and second_best_score >= 2 else None

        if best_score < 3 or confidence < 35 or best_score - second_best_score < 2:
            primary = "diger"

        return {
            "primary": primary,
            "secondary": secondary if primary != secondary else None,
            "confidence": confidence,
            "scores": scores,
        }

    def detect_em_focus_area(
        self,
        title: str,
        description: str,
        company_name: str = "",
        source_platform: str = "",
    ) -> str:
        return self.get_sector_classification(title, description, company_name, source_platform)["primary"]

    def detect_company_origin(self, company_name: str) -> str:
        name = self.normalize_turkish(company_name)
        if any(self.normalize_turkish(c) in name for c in self.KNOWN_TURKISH_COMPANIES):
            return "yerli"
        return "yabanci"

    def detect_internship_type(self, title: str, description: str) -> str:
        text = self.normalize_turkish(f"{title} {description}")
        if any(kw in text for kw in ["zorunlu staj", "staj 1", "staj 2", "uretim staji", "yonetim staji", "sgk"]):
            return "zorunlu"
        if any(kw in text for kw in ["gonullu", "part time", "yari zamanli"]):
            return "gonullu"
        return "belirsiz"

    def detect_program_type(self, title: str, description: str) -> Optional[str]:
        text = self.normalize_turkish(f"{title} {description}")
        for prog_type, keywords in self.PROGRAM_TYPE_RULES.items():
            if any(kw in text for kw in keywords):
                return prog_type
        return "kariyer_baslangic"

    TR_MONTHS = {
        "ocak": 1, "subat": 2, "mart": 3, "nisan": 4,
        "mayis": 5, "haziran": 6, "temmuz": 7, "agustos": 8,
        "eylul": 9, "ekim": 10, "kasim": 11, "aralik": 12,
    }
    EN_MONTHS = {
        "january": 1, "february": 2, "march": 3, "april": 4,
        "may": 5, "june": 6, "july": 7, "august": 8,
        "september": 9, "october": 10, "november": 11, "december": 12,
    }

    def parse_deadline(self, raw: Optional[str]) -> Optional[date]:
        """
        Parse deadline from various source formats.
        Returns None if date is in the past, unparseable, or missing.
        """
        if not raw:
            return None

        today = date.today()
        raw = raw.strip()
        norm = self.normalize_turkish(raw)

        if norm in ("bugun", "today", "bugun son gun"):
            return today

        if re.search(r"\d+\s*(gun once|days ago)", norm):
            return None
        if "30+" in norm and "once" in norm:
            return None

        match = re.search(r"(\d+)\s*(gun kaldi|days left|days remaining)", norm)
        if match:
            return today + timedelta(days=int(match.group(1)))

        match = re.match(r"(\d{4})-(\d{2})-(\d{2})", raw)
        if match:
            try:
                parsed = date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
                return parsed if parsed >= today else None
            except ValueError:
                return None

        match = re.search(r"(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})", norm)
        if match:
            month_num = self.TR_MONTHS.get(match.group(2))
            if month_num:
                try:
                    parsed = date(int(match.group(3)), month_num, int(match.group(1)))
                    return parsed if parsed >= today else None
                except ValueError:
                    return None

        match = re.search(r"([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})", raw)
        if match:
            month_num = self.EN_MONTHS.get(match.group(1).lower())
            if month_num:
                try:
                    parsed = date(int(match.group(3)), month_num, int(match.group(2)))
                    return parsed if parsed >= today else None
                except ValueError:
                    return None

        match = re.search(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", raw)
        if match:
            month_num = self.EN_MONTHS.get(match.group(2).lower())
            if month_num:
                try:
                    parsed = date(int(match.group(3)), month_num, int(match.group(1)))
                    return parsed if parsed >= today else None
                except ValueError:
                    return None

        match = re.match(r"(\d{2})[./](\d{2})[./](\d{4})", raw)
        if match:
            try:
                parsed = date(int(match.group(3)), int(match.group(2)), int(match.group(1)))
                return parsed if parsed >= today else None
            except ValueError:
                return None

        self.logger.debug(f'UNPARSED_DEADLINE: "{raw}"')
        return None

    def compute_deadline_status(self, deadline: Optional[date]) -> str:
        if deadline is None:
            return "unknown"
        today = date.today()
        if deadline < today:
            return "expired"
        if deadline <= today + timedelta(days=7):
            return "urgent"
        return "normal"
